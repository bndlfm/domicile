#!/usr/bin/env bash
# An extension's sidePanel.open() asks the shell's tray to open its side panel.
#
#   nix develop .#full --command \
#     ./packages/domicile-engine/scripts/guard-extension-side-panel.sh /build/chromium/src
#
# Why: from 26.37, Phantom answers a tray click with sidePanel.open() unless
# its user picked the popup. Chrome's function opens the panel beside a browser
# window's page, and a desk has no side panel, so nothing opened. The desk's
# function opens the side panel's page as a popup window of its own, at a side
# panel's size, which the shell draws as it draws any extension's popup window.
# See EXTENSIONS.md.
#
# Headless, with guard-extension-open-popup.sh's fixture, shell module and
# stand-in for the compositor. The shell opens one browser window, focuses it,
# and clicks the fixture's action once its service worker has cleared the
# popup. The listener calls sidePanel.open() and writes the answer into the
# window's address.
#
# It asserts:
# - the shell was given a popup window showing the fixture's side panel page,
#   with no size asked, so the shell tiles it
# - sidePanel.open() answered without an error
#
# Control: NEGATIVE=1 opens the window at `?nopanel`, where the listener turns
# its side panel off before calling sidePanel.open(). Chrome refuses that, so
# the shell must hear no request and the call must be refused with Chrome's
# error. A desk that opened every extension's page, or none, fails one of the
# two legs.
set -u

SCRIPTS="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=packages/domicile-engine/scripts/lib-annotate.sh
. "$SCRIPTS/lib-annotate.sh"
# shellcheck source=packages/domicile-engine/scripts/lib-last-words.sh
. "$SCRIPTS/lib-last-words.sh"
# shellcheck source=packages/domicile-engine/scripts/lib-ports.sh
. "$SCRIPTS/lib-ports.sh"
# shellcheck source=packages/domicile-engine/scripts/lib-profile.sh
. "$SCRIPTS/lib-profile.sh"
# shellcheck source=packages/domicile-engine/scripts/lib-broker.sh
. "$SCRIPTS/lib-broker.sh"

CHROMIUM="${1:-}"
if [ -z "$CHROMIUM" ]; then
  annotate "guard-extension-side-panel: no path to chromium/src was given"
  exit 1
fi

NEGATIVE="${NEGATIVE:-0}"

# The fixture, as the tray must name it. Fixed rather than overridable:
# `packages/domicile-engine/tests/test-extension-side-panel-guard.sh` holds the
# id to the manifest's `key`.
readonly ID="nhhdfdjeldbifampbehgfecbdenhehea"
readonly PANEL="chrome-extension://$ID/panel.html"
# No size asked: the shell tiles a side panel's window
# (domicile_desk_functions.cc).
readonly PANEL_SIZE="0x0"

EXTENSION="$SCRIPTS/guard-extension-open-popup-extension"

FOR_SECONDS="${FOR_SECONDS:-60}"

OUT="${OUT:-out/Domicile}"
BROKER="${BROKER:-/tmp/domicile-extension-side-panel-broker}"
CONTROL="${CONTROL:-/tmp/domicile-extension-side-panel-control}"
PROFILE="${PROFILE:-/tmp/domicile-extension-side-panel-profile}"
ENGINE_LOG="${ENGINE_LOG:-/tmp/domicile-extension-side-panel-engine.log}"
SOCKET_LOG="${SOCKET_LOG:-/tmp/domicile-extension-side-panel-socket.log}"
# One per leg, as guard-webview-tabs.sh's.
HTTP_LOG="${HTTP_LOG:-/tmp/domicile-extension-side-panel-http-$NEGATIVE.log}"

STARTED=()
cleanup() {
  if [ ${#STARTED[@]} -gt 0 ]; then
    kill "${STARTED[@]}" 2>/dev/null
    wait "${STARTED[@]}" 2>/dev/null
  fi
  remove_profile "$PROFILE"
}
trap cleanup EXIT

[ -x "$CHROMIUM/$OUT/chrome" ] || {
  annotate "guard-extension-side-panel: no engine at $CHROMIUM/$OUT/chrome; build it with ./packages/domicile-engine/scripts/build.sh"
  exit 1
}
command -v python3 >/dev/null || {
  skip "guard-extension-side-panel: no python3, and the compositor's end of the socket and the window's page are served by one"
  exit 77
}

wait_for_line() { # $1 tries, $2 pattern, $3 file
  for _ in $(seq 1 "$1"); do
    grep -qF "$2" "$3" 2>/dev/null && return 0
    sleep 0.25
  done
  return 1
}

fresh_broker
rm -f "$CONTROL"
rm -rf "$PROFILE"
mkdir -p "$PROFILE"

# 1. The browser window's page. Still, so its address keeps the answer.
rm -f "$HTTP_LOG"
python3 "$SCRIPTS/guard-webview-content-script-server.py" \
  --port 0 --color 25A8F9 --still >"$HTTP_LOG" 2>&1 &
STARTED+=($!)
wait_for_line 60 "serving" "$HTTP_LOG" || {
  annotate_from "guard-extension-side-panel: the window's page server never came up" "$HTTP_LOG"
  tail -20 "$HTTP_LOG" >&2
  exit 1
}
PORT="$(served_port "$HTTP_LOG")" || {
  annotate_from "guard-extension-side-panel: the window's page server never said which port it took" "$HTTP_LOG"
  exit 1
}
if [ "$NEGATIVE" = "1" ]; then
  A="http://127.0.0.1:$PORT/page?nopanel"
  ANSWER="refused"
  LEG=control
else
  A="http://127.0.0.1:$PORT/page?panel"
  ANSWER="opened"
  LEG=panel
fi

# 2. The compositor's end, naming the fixture in both legs.
rm -f "$SOCKET_LOG"
python3 "$SCRIPTS/guard-extension-installer-compositor.py" \
  --socket "$CONTROL" --unpacked "$EXTENSION" >"$SOCKET_LOG" 2>&1 &
STARTED+=($!)
wait_for_line 240 "listening on" "$SOCKET_LOG" || {
  annotate_from "guard-extension-side-panel: the compositor stand-in never listened on $CONTROL" "$SOCKET_LOG"
  tail -20 "$SOCKET_LOG" >&2
  exit 1
}

# 3. The engine.
rm -f "$ENGINE_LOG"
"$CHROMIUM/$OUT/chrome" \
  --ozone-platform=headless \
  --ozone-override-screen-size=1024,768 \
  --window-size=1024,768 \
  --disable-gpu \
  --app="domicile://shell/?expect=$ID&a=$A" \
  --domicile-shell-root="$SCRIPTS" \
  --domicile-shell-module="guard-extension-open-popup.js" \
  --domicile-control-socket="$CONTROL" \
  --no-sandbox --password-store=basic --no-first-run --disable-component-update \
  --user-data-dir="$PROFILE" \
  --enable-logging=stderr --log-level=0 \
  --domicile-broker-socket="$BROKER" >"$ENGINE_LOG" 2>&1 &
STARTED+=($!)

TRIES=$((FOR_SECONDS * 4))
wait_for_line "$TRIES" '"GUARD listening"' "$ENGINE_LOG" ||
  echo "the shell module never said it was listening; the verdict below says what that means" >&2

# 4. The wait. Both legs end on the fixture's answer. The request reaches the
#    shell before the answer, so a moment after it is enough to see one.
for _ in $(seq 1 "$TRIES"); do
  grep -qF -e "\"GUARD page url=${A}#opened" -e "\"GUARD page url=${A}#refused" \
    -e "\"GUARD page url=${A}#error-" "$ENGINE_LOG" 2>/dev/null && break
  sleep 0.25
done
sleep 1

# THE READINGS, each anchored on the quote Chromium puts after a console
# message -- see guard-windows-state.sh for why.
saw() { # $1 fixed string
  grep -qF -- "$1" "$ENGINE_LOG" 2>/dev/null && echo 1 || echo 0
}

SENT=0
grep -qF "sent the extensions" "$SOCKET_LOG" 2>/dev/null && SENT=1
CLEARED=$(saw "\"GUARD tray id=$ID popup=null\"")
CLICKED=$(saw '"GUARD activated"')
if [ "$NEGATIVE" = "1" ]; then
  # Any window or request at all: an extension with no side panel must open
  # nothing.
  REQUESTED=$(saw '"GUARD window ')
  [ "$REQUESTED" = 1 ] || REQUESTED=$(saw '"GUARD popup ')
else
  REQUESTED=$(saw "\"GUARD window url=$PANEL size=$PANEL_SIZE\"")
fi
ANSWERED=$(saw "\"GUARD page url=${A}#$ANSWER\"")

MEASURED="$LEG $SENT $CLEARED $CLICKED $REQUESTED $ANSWERED"
echo
echo "measured: $MEASURED"
echo "what the shell heard, and what the fixture answered:"
grep -F -e '"GUARD window ' -e '"GUARD popup ' -e '"GUARD page ' "$ENGINE_LOG" | tail -4 || true

# WHICH END TO BLAME. `packages/domicile-engine/tests/test-extension-side-panel-guard.sh`
# runs this block directly. MEASURED is "<leg> <sent> <cleared> <clicked>
# <requested> <answered>".
FAILURE=""
PASSED=""
case "$MEASURED" in
"panel 1 1 1 1 1")
  PASSED="the fixture's sidePanel.open() gave the shell a popup window \
showing its side panel's page with no size asked, and answered without \
an error"
  ;;
"control 1 1 1 0 1")
  PASSED="the control is sharp: sidePanel.open() with the side panel turned \
off asked the shell for nothing and was refused with Chrome's error -- so the \
claim's window is the panel the fixture names"
  ;;
"panel 0 "* | "control 0 "*)
  FAILURE="the list was never sent: the browser did not connect to the \
compositor stand-in, so the shell's control channel did not bind and nothing \
was installed"
  ;;
"panel 1 0 "* | "control 1 0 "*)
  FAILURE="the shell never saw the fixture's row with its popup cleared: the \
installer, the service worker's action.setPopup, or ExtensionTray"
  ;;
"panel 1 1 0 "* | "control 1 1 0 "*)
  FAILURE="the shell never clicked the action: the browser window never showed \
its page, so nothing was focused. The guest, or the page server"
  ;;
"panel 1 1 1 0 "*)
  FAILURE="sidePanel.open never gave the shell the panel's window: \
action.onClicked was not dispatched (ExtensionTray::Activate), Chrome's \
sidePanel.open answered in place of the desk's (RegisterDeskFunctions), or the \
popup window never reached the list (RequestPopupWindow), or not at the side \
panel's size. The GUARD window and page lines say what it opened and answered"
  ;;
"panel 1 1 1 1 0")
  FAILURE="the shell got the window and sidePanel.open did not answer \
\"opened\": the GUARD page lines say what it answered"
  ;;
"control 1 1 1 1 "*)
  FAILURE="sidePanel.open with the side panel turned off still reached the \
shell: the desk's function does not check the panel's options"
  ;;
"control 1 1 1 0 0")
  FAILURE="sidePanel.open with the side panel turned off was not refused with \
Chrome's error: the GUARD page lines say what it answered"
  ;;
*)
  FAILURE="there is no measurement here of any kind ($MEASURED) -- the run did \
not get as far as reading, or ran a leg this guard does not know"
  ;;
esac

if [ -n "$PASSED" ]; then
  echo "PASS: $PASSED"
  exit 0
fi

annotate_from "guard-extension-side-panel: $FAILURE" "$ENGINE_LOG"
echo "the compositor stand-in said:" >&2
tail -20 "$SOCKET_LOG" >&2
echo "the engine's last words ($ENGINE_LOG):" >&2
last_words "$ENGINE_LOG" >&2
echo "what the server was asked for:" >&2
tail -20 "$HTTP_LOG" >&2
exit 1
