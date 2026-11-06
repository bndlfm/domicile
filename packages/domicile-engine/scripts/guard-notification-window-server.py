#!/usr/bin/env python3
"""A notification server and the page guard-notification-window.sh loads.

Two jobs, so the guard starts one helper:

- Takes org.freedesktop.Notifications on the session bus and answers what
  Chrome's notification bridge asks: GetCapabilities, GetServerInformation and
  Notify. It prints each Notify's hints, one `NOTIFY <summary> <hints>` line,
  hints as JSON. Speaks the D-Bus wire protocol itself, because the guard's
  shell has no D-Bus module for Python.
- Serves `/notify`, a page that shows a notification named by its `?summary=`
  once it is allowed to.

The guard seeds the profile so the page's origin may notify.
"""

import argparse
import json
import os
import socket
import struct
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlsplit

NAME = "org.freedesktop.Notifications"
PATH = "/org/freedesktop/Notifications"

# What Chrome's bridge needs to use this server: `body` and `actions`, else it
# falls back to the portal.
CAPABILITIES = ["actions", "body", "persistence"]

PAGE = """<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>a page that notifies</title>
  </head>
  <body>
    <script>
      new Notification({summary});
      console.log("GUARD notified");
    </script>
  </body>
</html>
"""

# Message types and header fields of the D-Bus wire protocol.
METHOD_CALL, METHOD_RETURN, ERROR, SIGNAL = 1, 2, 3, 4
PATH_FIELD, INTERFACE_FIELD, MEMBER_FIELD = 1, 2, 3
REPLY_SERIAL_FIELD, DESTINATION_FIELD, SIGNATURE_FIELD = 5, 6, 8


def pad(offset, alignment):
    return (alignment - offset % alignment) % alignment


class Writer:
    """Marshals values little-endian, aligned from the message's start."""

    def __init__(self):
        self.data = bytearray()

    def align(self, alignment):
        self.data += b"\0" * pad(len(self.data), alignment)

    def byte(self, value):
        self.data += struct.pack("<B", value)

    def uint32(self, value):
        self.align(4)
        self.data += struct.pack("<I", value)

    def string(self, value):
        encoded = value.encode()
        self.uint32(len(encoded))
        self.data += encoded + b"\0"

    def signature(self, value):
        encoded = value.encode()
        self.byte(len(encoded))
        self.data += encoded + b"\0"

    def strings(self, values):
        self.uint32(0)
        length_at = len(self.data) - 4
        self.align(4)
        start = len(self.data)
        for value in values:
            self.string(value)
        struct.pack_into("<I", self.data, length_at, len(self.data) - start)


class Reader:
    """Unmarshals the values Notify carries, aligned from the body's start."""

    def __init__(self, data):
        self.data = data
        self.at = 0

    def align(self, alignment):
        self.at += pad(self.at, alignment)

    def take(self, code):
        if code in "y":
            value = self.data[self.at]
            self.at += 1
            return value
        if code in "bui":
            self.align(4)
            (value,) = struct.unpack_from("<i" if code == "i" else "<I", self.data, self.at)
            self.at += 4
            return bool(value) if code == "b" else value
        if code in "so":
            self.align(4)
            (length,) = struct.unpack_from("<I", self.data, self.at)
            self.at += 4
            value = self.data[self.at : self.at + length].decode()
            self.at += length + 1
            return value
        if code == "g":
            length = self.data[self.at]
            value = self.data[self.at + 1 : self.at + 1 + length].decode()
            self.at += length + 2
            return value
        raise ValueError(f"cannot read {code}")

    def skip_array(self, element_alignment):
        self.align(4)
        (length,) = struct.unpack_from("<I", self.data, self.at)
        self.at += 4
        self.align(element_alignment)
        self.at += length

    def strings(self):
        self.align(4)
        (length,) = struct.unpack_from("<I", self.data, self.at)
        self.at += 4
        end = self.at + length
        values = []
        while self.at < end:
            values.append(self.take("s"))
        return values

    def hints(self):
        """An a{sv}, keeping the string-valued and integer-valued hints."""
        self.align(4)
        (length,) = struct.unpack_from("<I", self.data, self.at)
        self.at += 4
        self.align(8)
        end = self.at + length
        hints = {}
        while self.at < end:
            self.align(8)
            key = self.take("s")
            signature = self.take("g")
            if signature in ("s", "u", "i", "b", "y"):
                hints[key] = self.take(signature)
            elif signature == "(iiibiiay)":
                # image-data: a picture this guard does not read.
                self.align(8)
                for code in "iiibii":
                    self.take(code)
                self.skip_array(1)
                hints[key] = "<image>"
            else:
                raise ValueError(f"hint {key} has signature {signature}")
        return hints


class Bus:
    """One connection to the session bus."""

    def __init__(self, address):
        path = address.split("unix:path=", 1)[1].split(",", 1)[0]
        self.sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        self.sock.connect(path)
        self.serial = 0
        self.buffer = b""
        uid = str(os.getuid()).encode().hex()
        self.sock.sendall(b"\0AUTH EXTERNAL " + uid.encode() + b"\r\n")
        if not self.line().startswith(b"OK"):
            raise RuntimeError("the bus refused EXTERNAL")
        self.sock.sendall(b"BEGIN\r\n")

    def line(self):
        while b"\r\n" not in self.buffer:
            self.buffer += self.sock.recv(4096)
        line, self.buffer = self.buffer.split(b"\r\n", 1)
        return line

    def send(self, kind, fields, signature="", body=b"", flags=0):
        self.serial += 1
        if signature:
            fields = fields + [(SIGNATURE_FIELD, "g", signature)]
        header = Writer()
        header.data += b"l" + bytes([kind, flags, 1])
        header.uint32(len(body))
        header.uint32(self.serial)
        header.uint32(0)
        array_start = len(header.data)
        for code, kind_of, value in fields:
            header.align(8)
            header.byte(code)
            header.signature(kind_of)
            {"o": header.string, "s": header.string, "u": header.uint32, "g": header.signature}[kind_of](value)
        struct.pack_into("<I", header.data, array_start - 4, len(header.data) - array_start)
        header.align(8)
        self.sock.sendall(bytes(header.data) + body)
        return self.serial

    def call_bus(self, member, signature="", body=b""):
        self.send(
            METHOD_CALL,
            [
                (PATH_FIELD, "o", "/org/freedesktop/DBus"),
                (INTERFACE_FIELD, "s", "org.freedesktop.DBus"),
                (MEMBER_FIELD, "s", member),
                (DESTINATION_FIELD, "s", "org.freedesktop.DBus"),
            ],
            signature,
            body,
        )

    def reply(self, call, signature, body):
        fields = [(REPLY_SERIAL_FIELD, "u", call["serial"])]
        if "sender" in call:
            fields.append((DESTINATION_FIELD, "s", call["sender"]))
        self.send(METHOD_RETURN, fields, signature, body)

    def receive(self):
        """The next message: its kind, serial, header fields and body."""
        while len(self.buffer) < 16:
            self.buffer += self.sock.recv(65536)
        body_length, serial, fields_length = struct.unpack_from("<III", self.buffer, 4)
        header_length = 16 + fields_length + pad(16 + fields_length, 8)
        while len(self.buffer) < header_length + body_length:
            self.buffer += self.sock.recv(65536)
        message = {"kind": self.buffer[1], "serial": serial}
        fields = Reader(self.buffer[16 : 16 + fields_length])
        names = {1: "path", 2: "interface", 3: "member", 6: "destination", 7: "sender", 8: "signature"}
        while fields.at < fields_length:
            fields.align(8)
            code = fields.take("y")
            kind = fields.take("g")
            value = fields.take(kind)
            if code in names:
                message[names[code]] = value
        message["body"] = self.buffer[header_length : header_length + body_length]
        self.buffer = self.buffer[header_length + body_length :]
        return message


def serve_notifications(address):
    bus = Bus(address)
    bus.call_bus("Hello")
    name = Writer()
    name.string(NAME)
    name.uint32(4)  # DBUS_NAME_FLAG_DO_NOT_QUEUE
    bus.call_bus("RequestName", "su", bytes(name.data))
    print(f"took {NAME}", flush=True)
    next_id = 1
    while True:
        message = bus.receive()
        if message["kind"] != METHOD_CALL or message.get("interface") != NAME:
            continue
        member = message.get("member")
        if member == "GetCapabilities":
            body = Writer()
            body.strings(CAPABILITIES)
            bus.reply(message, "as", bytes(body.data))
        elif member == "GetServerInformation":
            body = Writer()
            for value in ("guard", "domicile", "1", "1.2"):
                body.string(value)
            bus.reply(message, "ssss", bytes(body.data))
        elif member == "Notify":
            read = Reader(message["body"])
            read.take("s")
            read.take("u")
            read.take("s")
            summary = read.take("s")
            read.take("s")
            read.strings()
            hints = read.hints()
            print(f"NOTIFY {summary} {json.dumps(hints, sort_keys=True)}", flush=True)
            body = Writer()
            body.uint32(next_id)
            next_id += 1
            bus.reply(message, "u", bytes(body.data))


def handler_for():
    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            url = urlsplit(self.path)
            if url.path != "/notify":
                self.send_error(404)
                return
            summary = parse_qs(url.query).get("summary", ["guard"])[0]
            page = PAGE.format(summary=json.dumps(summary)).encode()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(page)))
            self.end_headers()
            self.wfile.write(page)

        def log_message(self, *_):
            pass

    return Handler


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=0)
    args = parser.parse_args()
    address = os.environ.get("DBUS_SESSION_BUS_ADDRESS", "")
    if "unix:path=" not in address:
        print("DBUS_SESSION_BUS_ADDRESS names no unix:path= bus", file=sys.stderr)
        return 1
    threading.Thread(target=serve_notifications, args=(address,), daemon=True).start()
    server = ThreadingHTTPServer(("127.0.0.1", args.port), handler_for())
    print(f"serving the page on 127.0.0.1:{server.server_address[1]}", flush=True)
    server.serve_forever()
    return 0


if __name__ == "__main__":
    sys.exit(main())
