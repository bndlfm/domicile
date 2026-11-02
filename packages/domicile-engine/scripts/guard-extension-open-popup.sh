#!/usr/bin/env bash
# An extension's action.openPopup() asks the shell's tray to open its popup.
#
#   nix develop .#full --command \
#     ./packages/domicile-engine/scripts/guard-extension-open-popup.sh /build/chromium/src
#
# Why: Phantom clears its action's popup so a tray click reaches
# action.onClicked, then sets it and calls action.openPopup(). Chrome's
# function opens the popup in a browser window's toolbar, and a desk has none.
# The desk's function sends the popup to the shell as
# `extensionpopuprequested` instead. See EXTENSIONS.md.
#
# Headless, with guard-extension-installer.sh's stand-in for the compositor
# naming the fixture as `unpacked`. The shell opens one browser window,
# focuses it, and clicks the fixture's action once its service worker has
# cleared the popup. The listener sets the popup, calls action.openPopup() and
# writes the answer into the window's address.
#
# It asserts:
# - the shell heard the request, naming the fixture and its popup
# - action.openPopup() answered without an error
#
# Control: NEGATIVE=1 opens the window at `?bare`, where the listener calls
# action.openPopup() with no popup set. Chrome refuses that, so the shell must
# hear no request and the call must be refused with Chrome's error. A desk
# that opened every action's popup, or none, fails one of the two legs.
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
  annotate "guard-extension-open-popup: no path to chromium/src was given"
  exit 1
fi

NEGATIVE="${NEGATIVE:-0}"

# The fixture, as the tray must name it. Fixed rather than overridable:
# `packages/domicile-engine/tests/test-extension-open-popup-guard.sh` holds the
# id to the manifest's `key`.
readonly ID="nhhdfdjeldbifampbehgfecbdenhehea"
readonly POPUP="chrome-extension://$ID/popup.html"

EXTENSION="$SCRIPTS/guard-extension-open-popup-extension"

FOR_SECONDS="${FOR_SECONDS:-60}"

OUT="${OUT:-out/Domicile}"
BROKER="${BROKER:-/tmp/domicile-extension-open-popup-broker}"
CONTROL="${CONTROL:-/tmp/domicile-extension-open-popup-control}"
PROFILE="${PROFILE:-/tmp/domicile-extension-open-popup-profile}"
ENGINE_LOG="${ENGINE_LOG:-/tmp/domicile-extension-open-popup-engine.log}"
SOCKET_LOG="${SOCKET_LOG:-/tmp/domicile-extension-open-popup-socket.log}"
# One per leg, as guard-webview-tabs.sh's.
HTTP_LOG="${HTTP_LOG:-/tmp/domicile-extension-open-popup-http-$NEGATIVE.log}"

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
  annotate "guard-extension-open-popup: no engine at $CHROMIUM/$OUT/chrome; build it with ./packages/domicile-engine/scripts/build.sh"
  exit 1
}
command -v python3 >/dev/null || {
  skip "guard-extension-open-popup: no python3, and the compositor's end of the socket and the window's page are served by one"
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
  annotate_from "guard-extension-open-popup: the window's page server never came up" "$HTTP_LOG"
  tail -20 "$HTTP_LOG" >&2
  exit 1
}
PORT="$(served_port "$HTTP_LOG")" || {
  annotate_from "guard-extension-open-popup: the window's page server never said which port it took" "$HTTP_LOG"
  exit 1
}
if [ "$NEGATIVE" = "1" ]; then
  A="http://127.0.0.1:$PORT/page?bare"
  ANSWER="refused"
  LEG=control
else
  A="http://127.0.0.1:$PORT/page?ask"
  ANSWER="opened"
  LEG=popup
fi

# 2. The compositor's end, naming the fixture in both legs.
rm -f "$SOCKET_LOG"
python3 "$SCRIPTS/guard-extension-installer-compositor.py" \
  --socket "$CONTROL" --unpacked "$EXTENSION" >"$SOCKET_LOG" 2>&1 &
STARTED+=($!)
wait_for_line 240 "listening on" "$SOCKET_LOG" || {
  annotate_from "guard-extension-open-popup: the compositor stand-in never listened on $CONTROL" "$SOCKET_LOG"
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
  # Any request at all: an action with no popup must ask for none.
  REQUESTED=$(saw '"GUARD popup ')
else
  REQUESTED=$(saw "\"GUARD popup id=$ID popup=$POPUP\"")
fi
ANSWERED=$(saw "\"GUARD page url=${A}#$ANSWER\"")

MEASURED="$LEG $SENT $CLEARED $CLICKED $REQUESTED $ANSWERED"
echo
echo "measured: $MEASURED"
echo "what the shell heard, and what the fixture answered:"
grep -F -e '"GUARD popup ' -e '"GUARD page ' "$ENGINE_LOG" | tail -4 || true

# WHICH END TO BLAME. `packages/domicile-engine/tests/test-extension-open-popup-guard.sh`
# runs this block directly. MEASURED is "<leg> <sent> <cleared> <clicked>
# <requested> <answered>".
FAILURE=""
PASSED=""
case "$MEASURED" in
"popup 1 1 1 1 1")
  PASSED="the fixture's action.openPopup() reached the shell as \
extensionpopuprequested, naming its popup, and answered without an error"
  ;;
"control 1 1 1 0 1")
  PASSED="the control is sharp: action.openPopup() with no popup set asked the \
shell for nothing and was refused with Chrome's error -- so the claim's \
request is the popup the fixture set"
  ;;
"popup 0 "* | "control 0 "*)
  FAILURE="the list was never sent: the browser did not connect to the \
compositor stand-in, so the shell's control channel did not bind and nothing \
was installed"
  ;;
"popup 1 0 "* | "control 1 0 "*)
  FAILURE="the shell never saw the fixture's row with its popup cleared: the \
installer, the service worker's action.setPopup, or ExtensionTray"
  ;;
"popup 1 1 0 "* | "control 1 1 0 "*)
  FAILURE="the shell never clicked the action: the browser window never showed \
its page, so nothing was focused. The guest, or the page server"
  ;;
"popup 1 1 1 0 "*)
  FAILURE="the click never reached the shell as extensionpopuprequested: \
action.onClicked was not dispatched (ExtensionTray::Activate), Chrome's \
action.openPopup answered in place of the desk's (RegisterDeskFunctions), or \
the request did not reach DomicileHost (RequestExtensionPopup, PopupRequested). \
The GUARD page lines say what action.openPopup answered"
  ;;
"popup 1 1 1 1 0")
  FAILURE="the shell heard the request and action.openPopup did not answer \
\"opened\": the GUARD page lines say what it answered"
  ;;
"control 1 1 1 1 "*)
  FAILURE="action.openPopup with no popup set still reached the shell: the \
desk's function does not check the action's popup on the active tab"
  ;;
"control 1 1 1 0 0")
  FAILURE="action.openPopup with no popup set was not refused with Chrome's \
error: the GUARD page lines say what it answered"
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

annotate_from "guard-extension-open-popup: $FAILURE" "$ENGINE_LOG"
echo "the compositor stand-in said:" >&2
tail -20 "$SOCKET_LOG" >&2
echo "the engine's last words ($ENGINE_LOG):" >&2
last_words "$ENGINE_LOG" >&2
echo "what the server was asked for:" >&2
tail -20 "$HTTP_LOG" >&2
exit 1
