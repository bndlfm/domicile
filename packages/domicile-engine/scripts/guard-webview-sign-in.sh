#!/usr/bin/env bash
# A page in a browser window asks to sign in, the shell is asked instead of
# Chrome's dialog, and its answer signs the page in.
#
#   nix develop .#full --command \
#     ./packages/domicile-engine/scripts/guard-webview-sign-in.sh /build/chromium/src
#
# Headless with software compositing, like guard-webview-click.sh: nothing here
# is measured in pixels, and nothing is pressed.
#
# Chrome asks for a sign-in (HTTP authentication) with a dialog anchored to the
# outermost WebContents' window, which for a guest is the shell's. Patch 0177's
# override makes a LoginHandler that sends it to the element as
# SignInRequested instead, and the element fires `domicile-sign-in`. The shell
# signs in with the server's user name and password. A unit test cannot check
# this: happy-dom has no guest and no network stack.
#
# The pages are guard-webview-sign-in-server.py's: /page is behind a sign-in,
# /open is not.
#
# Assertions, in order; each is meaningful only if the previous one holds:
#
#   the shell page ran               or nothing was set up
#   the server asked to sign in      the guest was made, attached and
#                                     navigated, and the request got a 401
#   the browser asked the shell      the override ran in place of Chrome's
#                                     dialog
#   the shell heard the request      `domicile-sign-in` reached it, with the
#                                     site, the realm, proxy and secure
#   the shell answered               its signIn() did not throw
#   the browser got the answer       domicile_sign_in logged it
#   the page signed in               Chrome sent the user name and password,
#                                     and the server let the page load
#
# NEGATIVE=1 is the control: the window loads /open, which needs no sign-in.
# Nothing may be reported, or the positive run's report could come from the
# load rather than the sign-in.
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
  annotate "guard-webview-sign-in: no path to chromium/src was given"
  exit 1
fi

# NEGATIVE=1 runs the control. See the header.
NEGATIVE="${NEGATIVE:-0}"

OUT="${OUT:-out/Domicile}"
BROKER="${BROKER:-/tmp/domicile-webview-sign-in-broker}"
PROFILE="${PROFILE:-/tmp/domicile-webview-sign-in-profile}"
WIDTH="${WIDTH:-1024}"
HEIGHT="${HEIGHT:-768}"

# Height of the shell's strip in CSS pixels.
#
# Not `STRIP`: `nix develop .#full` exports `STRIP=strip`. See
# guard-webview-external-app.sh.
STRIP_HEIGHT="${STRIP_HEIGHT:-64}"

# Time for the shell to load and its guest to attach and navigate, and for
# each report the positive run waits on.
FOR_SECONDS="${FOR_SECONDS:-90}"

# The run and the control write separate logs, so both can be compared when
# they disagree.
WHICH=""
[ "$NEGATIVE" = "1" ] && WHICH="-negative"
ENGINE_LOG="${ENGINE_LOG:-/tmp/domicile-webview-sign-in$WHICH-engine.log}"
HTTP_LOG="${HTTP_LOG:-/tmp/domicile-webview-sign-in$WHICH-http.log}"

STARTED=()
cleanup() {
  if [ ${#STARTED[@]} -gt 0 ]; then
    kill "${STARTED[@]}" 2>/dev/null
  fi
  remove_profile "$PROFILE"
}
trap cleanup EXIT

[ -x "$CHROMIUM/$OUT/chrome" ] || {
  annotate "guard-webview-sign-in: no engine at $CHROMIUM/$OUT/chrome; build it with ./packages/domicile-engine/scripts/build.sh"
  exit 1
}
command -v python3 >/dev/null || {
  skip "guard-webview-sign-in: no python3, and the page in the window is served by one"
  exit 77
}

fresh_broker
rm -rf "$PROFILE"; mkdir -p "$PROFILE"

# Waits for `$2` to appear in `$3`, for `$1` quarter-seconds.
wait_for_line() { # $1 tries, $2 pattern, $3 file
  for _ in $(seq 1 "$1"); do
    grep -qF "$2" "$3" 2>/dev/null && return 0
    sleep 0.25
  done
  return 1
}

# 1. The pages: one local server, because `crux` cannot reach arbitrary hosts.
rm -f "$HTTP_LOG"
python3 "$SCRIPTS/guard-webview-sign-in-server.py" --port 0 \
  >"$HTTP_LOG" 2>&1 &
STARTED+=($!)
wait_for_line 240 "serving" "$HTTP_LOG" || {
  annotate_from "guard-webview-sign-in: its page server never came up" "$HTTP_LOG"
  echo "the server said:" >&2
  tail -20 "$HTTP_LOG" >&2
  exit 1
}
PORT="$(served_port "$HTTP_LOG")" || {
  annotate_from "guard-webview-sign-in: its page server never said which port it took" "$HTTP_LOG"
  exit 1
}
SITE="http://127.0.0.1:$PORT"
PAGE="$SITE/page"
[ "$NEGATIVE" = "1" ] && PAGE="$SITE/open"
echo "serving $PAGE"

# 2. The engine, on a domicile:// document, because the browser binds
#    WebViewGuestHost for that origin only.
rm -f "$ENGINE_LOG"
"$CHROMIUM/$OUT/chrome" \
  --ozone-platform=headless \
  --disable-gpu \
  --app="domicile://shell/?strip=$STRIP_HEIGHT&src=$PAGE" \
  --domicile-shell-root="$SCRIPTS" \
  --domicile-shell-module="guard-webview-sign-in.js" \
  --no-sandbox --password-store=basic --no-first-run --disable-component-update \
  --user-data-dir="$PROFILE" \
  --window-size="$WIDTH,$HEIGHT" \
  --enable-logging=stderr --log-level=0 \
  --domicile-broker-socket="$BROKER" >"$ENGINE_LOG" 2>&1 &
STARTED+=($!)

TRIES=$((FOR_SECONDS * 4))
wait_for_line "$TRIES" "GUARD shell-loaded" "$ENGINE_LOG" || {
  annotate_from "guard-webview-sign-in: the shell page never ran, so nothing here was ever set up" "$ENGINE_LOG"
  echo "the engine said:" >&2
  tail -40 "$ENGINE_LOG" >&2
  exit 1
}
echo "the shell is up, with a <webview> under a ${STRIP_HEIGHT}px strip"

ASKED_LINE="domicile: a <webview>'s site asked to sign in; asking the shell."
SETTLED_LINE="domicile: a <webview>'s sign-in was answered: signed in."

# 3. The sign-in, or in the control the page that needs none.
if [ "$NEGATIVE" = "1" ]; then
  wait_for_line "$TRIES" "GUARD page-loaded" "$ENGINE_LOG" ||
    echo "nothing ever loaded in the window" >&2
  # A fixed wait, not a poll, because the control expects an absence.
  sleep 5
else
  wait_for_line "$TRIES" "GUARD page-signed-in" "$ENGINE_LOG" ||
    echo "the page never signed in" >&2
fi

saw() { # $1 pattern, $2 file
  grep -qF "$1" "${2:-$ENGINE_LOG}" && echo 1 || echo 0
}

SAW_SHELL=$(saw "GUARD shell-loaded")
SAW_LOADED=$(saw "GUARD page-loaded")
SAW_CHALLENGED=$(saw "asked-to-sign-in" "$HTTP_LOG")
SAW_ASKED=$(saw "$ASKED_LINE")
SAW_HEARD=$(saw "GUARD sign-in origin=$SITE realm=domicile guard proxy=false secure=true")
SAW_ANSWERED=$(saw "GUARD sign-in-answered")
SAW_SETTLED=$(saw "$SETTLED_LINE")
SAW_SIGNED_IN=$(saw "GUARD page-signed-in")
SAW_ANY=$( (grep -qF "GUARD sign-in" "$ENGINE_LOG" ||
  grep -qF "asked to sign in" "$ENGINE_LOG") && echo 1 || echo 0)

echo
echo "shell=$SAW_SHELL loaded=$SAW_LOADED challenged=$SAW_CHALLENGED"
echo "sign-in: asked=$SAW_ASKED heard=$SAW_HEARD answered=$SAW_ANSWERED settled=$SAW_SETTLED signed-in=$SAW_SIGNED_IN any=$SAW_ANY"
echo

# The verdict: names the component to blame. Checks run in dependency order.
# `packages/domicile-engine/tests/test-webview-sign-in-guard.sh` runs this block directly.
FAILURE=""
PASSED=""
if [ "$SAW_SHELL" != "1" ]; then
  FAILURE="the shell page never ran, so nothing here was set up. This is the \
harness: the module did not load, or it threw, and the engine log has its \
console"
elif [ "$NEGATIVE" = "1" ]; then
  if [ "$SAW_LOADED" != "1" ]; then
    FAILURE="nothing loaded in the window, so the control measured nothing. \
That is the guest: it was not made, attached or navigated"
  elif [ "$SAW_ANY" = "1" ]; then
    FAILURE="the control loaded a page that needs no sign-in and a request \
was reported anyway, so the positive run's report may come from the load \
rather than the sign-in"
  else
    PASSED="the control is sharp: a page that needs no sign-in reported no \
request"
  fi
elif [ "$SAW_CHALLENGED" != "1" ]; then
  FAILURE="the server never asked to sign in, so the window never requested \
the page. That is the guest: it was not made, attached or navigated"
elif [ "$SAW_ASKED" != "1" ]; then
  FAILURE="the server asked to sign in and the browser never asked the \
shell. LoginHandler did not make the SetCreateOverride handler: Chrome \
asked with its own dialog, or HttpAuthCoordinator gave up first"
elif [ "$SAW_HEARD" != "1" ]; then
  FAILURE="the browser asked and the shell never heard. SignInRequested did \
not reach the element, or the element did not fire domicile-sign-in with the \
site, the realm, proxy and secure"
elif [ "$SAW_ANSWERED" != "1" ]; then
  FAILURE="the shell heard the request and its signIn() did not return. The \
event's answer threw: the engine log has the shell's console"
elif [ "$SAW_SETTLED" != "1" ]; then
  FAILURE="the shell answered and the browser never logged it. The reply did \
not reach domicile_sign_in"
elif [ "$SAW_SIGNED_IN" != "1" ]; then
  FAILURE="the browser got the user name and password and the page never \
signed in. LoginHandler::SetAuth did not resend the request with them"
else
  PASSED="the site asked to sign in, the shell was asked in place of \
Chrome's dialog, and its answer signed the page in"
fi

if [ -n "$PASSED" ]; then
  echo "PASS: $PASSED"
  exit 0
fi

annotate "guard-webview-sign-in: $FAILURE"
echo "the engine's last words:" >&2
last_words "$ENGINE_LOG" >&2
echo "the server said:" >&2
tail -20 "$HTTP_LOG" >&2
exit 1
