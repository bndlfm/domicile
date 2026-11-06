#!/usr/bin/env python3
"""Serves the pages guard-webview-sign-in.sh loads, one behind a sign-in.

  /page     answers 401 with `WWW-Authenticate: Basic realm="domicile guard"`
            until a request carries the user name `guard` and the password
            `hello`. Then a page that logs `GUARD page-signed-in`. Logs
            `asked-to-sign-in` for each 401 it sends.
  /open     a page that needs no sign-in and logs `GUARD page-loaded`, for
            the guard's control.

Served over HTTP because `crux` cannot reach arbitrary hosts.
"""

import argparse
import base64
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

SIGNED_IN = "/page"
OPEN = "/open"
REALM = "domicile guard"
CREDENTIALS = "Basic " + base64.b64encode(b"guard:hello").decode("ascii")


def page(says):
    return """<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>a page for the sign-in guard</title>
  </head>
  <body>
    <script>
      console.log("GUARD %s");
    </script>
  </body>
</html>
""" % says


class TwoPages(BaseHTTPRequestHandler):
    """Answers the paths above, and everything else with a 404."""

    def do_GET(self):  # noqa: N802 - the name is BaseHTTPRequestHandler's
        if self.path == OPEN:
            self.send_page(page("page-loaded"))
        elif self.path != SIGNED_IN:
            self.send_error(404, "this server has two pages and that is not one")
        elif self.headers.get("Authorization") == CREDENTIALS:
            self.send_page(page("page-signed-in"))
        else:
            # Flushed, since the guard reads it while this server runs.
            print("asked-to-sign-in", flush=True)
            encoded = b"sign in first"
            self.send_response(401)
            self.send_header("WWW-Authenticate", 'Basic realm="%s"' % REALM)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Content-Length", str(len(encoded)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(encoded)

    def send_page(self, html):
        encoded = html.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        # So a run is never served a cached page from an earlier run.
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(encoded)

    def log_message(self, fmt, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--port",
        type=int,
        required=True,
        help="0 for any free one; the serving line names the one taken",
    )
    arguments = parser.parse_args()

    # Loopback only: nothing outside this machine should reach the fixture.
    server = ThreadingHTTPServer(("127.0.0.1", arguments.port), TwoPages)
    # Flushed before serve_forever, since the guard waits for this line.
    print(
        "serving %s and %s on 127.0.0.1:%d"
        % (SIGNED_IN, OPEN, server.server_address[1]),
        flush=True,
    )
    server.serve_forever()


if __name__ == "__main__":
    main()
