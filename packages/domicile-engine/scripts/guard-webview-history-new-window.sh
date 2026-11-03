#!/usr/bin/env bash
# Checks `goBackInNewWindow()` opens a browser window one step back through a
# copy of the view's history, as a middle click on Chrome's back button does,
# and leaves the view on its page.
#
#   nix develop .#full --command \
#     ./packages/domicile-engine/scripts/guard-webview-history-new-window.sh /build/chromium/src
#
# Runs headless with software compositing: nothing is measured in pixels.
#
# The view goes to /one, then /two, then the call. `WebViewGuest::OpenHistoryStep`
# asks the desk for a window; `TakeHistoryStep` copies the history into its
# page and goes back there. The shell draws the listed window in a second
# <webview>.
#
# Asserts, in order, since each reading depends on the one before:
#
#   - the shell module ran
#   - the view showed /two, so it had somewhere to go back to
#   - a browser window was listed, at /one
#   - the shell drew it, and the second view shows /one
#   - with forward available there, so the history was copied, not just /one
#     opened
#   - the first view stayed on /two
#
# NEGATIVE=1 is the control: the same view and navigations, then goBack(). It
# must open no window and must move the view to /one, so a window opened for
# any back cannot pass, and the positive run's view staying put is the call's.
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
  annotate "guard-webview-history-new-window: no path to chromium/src was given"
  exit 1
fi

# NEGATIVE=1 calls goBack() instead. See the header.
NEGATIVE="${NEGATIVE:-0}"
DRIVE="new-window"
[ "$NEGATIVE" = "1" ] && DRIVE="back"

OUT="${OUT:-out/Domicile}"
BROKER="${BROKER:-/tmp/domicile-webview-history-new-window-broker}"
PROFILE="${PROFILE:-/tmp/domicile-webview-history-new-window-profile}"
WIDTH="${WIDTH:-1024}"
HEIGHT="${HEIGHT:-768}"

# SETTLE is the timeout for the first page; STEP for each later one, and how
# long the run watches after the call.
SETTLE_MS="${SETTLE_MS:-25000}"
STEP_MS="${STEP_MS:-8000}"

# SETTLE + three STEPs, plus engine startup, with margin for a shared machine.
FOR_SECONDS="${FOR_SECONDS:-120}"

# The fixture's /slow is unused; it only needs a value.
SLOW_SECONDS=1

WHICH=""
[ "$NEGATIVE" = "1" ] && WHICH="-negative"
ENGINE_LOG="${ENGINE_LOG:-/tmp/domicile-webview-history-new-window$WHICH-engine.log}"
HTTP_LOG="${HTTP_LOG:-/tmp/domicile-webview-history-new-window$WHICH-http.log}"

STARTED=()
cleanup() {
  if [ ${#STARTED[@]} -gt 0 ]; then
    kill "${STARTED[@]}" 2>/dev/null
  fi
  remove_profile "$PROFILE"
}
trap cleanup EXIT

[ -x "$CHROMIUM/$OUT/chrome" ] || {
  annotate "guard-webview-history-new-window: no engine at $CHROMIUM/$OUT/chrome; build it with ./packages/domicile-engine/scripts/build.sh"
  exit 1
}
command -v python3 >/dev/null || {
  skip "guard-webview-history-new-window: no python3, and the pages the view has a history of are served by one"
  exit 77
}

fresh_broker
rm -rf "$PROFILE"; mkdir -p "$PROFILE"

# Waits for `$2` to appear in `$3`, for `$1` quarter seconds.
wait_for_line() { # $1 tries, $2 pattern, $3 file
  for _ in $(seq 1 "$1"); do
    grep -qF "$2" "$3" 2>/dev/null && return 0
    sleep 0.25
  done
  return 1
}

# 1. The pages, from the history guard's server: `crux` cannot reach
#    arbitrary hosts.
rm -f "$HTTP_LOG"
python3 "$SCRIPTS/guard-webview-history-server.py" \
  --port 0 --slow-seconds "$SLOW_SECONDS" >"$HTTP_LOG" 2>&1 &
STARTED+=($!)
wait_for_line 240 "serving" "$HTTP_LOG" || {
  annotate_from "guard-webview-history-new-window: its page server never came up" "$HTTP_LOG"
  tail -20 "$HTTP_LOG" >&2
  exit 1
}
PORT="$(served_port "$HTTP_LOG")" || {
  annotate_from "guard-webview-history-new-window: its page server never said which port it took" "$HTTP_LOG"
  exit 1
}
SITE="http://127.0.0.1:$PORT"
echo "serving the view's pages under $SITE"

# 2. The engine, on a domicile:// document: the browser binds
#    WebViewGuestHost only for that origin.
rm -f "$ENGINE_LOG"
"$CHROMIUM/$OUT/chrome" \
  --ozone-platform=headless \
  --disable-gpu \
  --app="domicile://shell/?drive=$DRIVE&src=$SITE&settle=$SETTLE_MS&step=$STEP_MS" \
  --domicile-shell-root="$SCRIPTS" \
  --domicile-shell-module="guard-webview-history-new-window.js" \
  --no-sandbox --password-store=basic --no-first-run --disable-component-update \
  --user-data-dir="$PROFILE" \
  --window-size="$WIDTH,$HEIGHT" \
  --enable-logging=stderr --log-level=0 \
  --domicile-broker-socket="$BROKER" >"$ENGINE_LOG" 2>&1 &
STARTED+=($!)

TRIES=$((FOR_SECONDS * 4))
wait_for_line "$TRIES" "GUARD driving" "$ENGINE_LOG" || {
  annotate_from "guard-webview-history-new-window: the shell module never ran, so nothing was ever driven" "$ENGINE_LOG"
  tail -40 "$ENGINE_LOG" >&2
  exit 1
}
echo "the shell is driving mode=$DRIVE"

# 3. The module runs the schedule and watches after the call. Wait for its
#    last line rather than a fixed time.
wait_for_line "$TRIES" "GUARD done" "$ENGINE_LOG" ||
  echo "the schedule never finished; what follows is a run cut short" >&2

saw() { # $1 pattern
  grep -qF "$1" "$ENGINE_LOG" && echo 1 || echo 0
}

SAW_DRIVING=$(saw "GUARD driving mode=$DRIVE")
SAW_TWO=$(saw "GUARD guest-shown path=/two")
SAW_ASKED=$(saw "GUARD new-window url=")
# The address too: a window at the page the view was on would otherwise pass.
SAW_ADDRESS=$(saw "GUARD new-window url=$SITE/one")
SAW_SECOND=$(saw "GUARD second-view")
SAW_SECOND_PAGE=$(saw "GUARD second-page path=/one")
# Forward is available only in a copy of the history. A window opened at /one
# alone has nowhere to go forward to.
SAW_COPIED=$(saw "GUARD second-page path=/one can=false/true")
SAW_STAYED=$(saw "GUARD first-page path=/two")
SAW_WENT_BACK=$(saw "GUARD first-page path=/one")
# Logged by WebViewGuest::TakeHistoryStep. Separates "the call reached no
# window" from "the window was made and never listed".
SAW_TOOK=$(saw "took a step through a copy of another page's history")

echo
echo "shell=$SAW_DRIVING two=$SAW_TWO"
echo "the shell's document saw: asked=$SAW_ASKED address=$SAW_ADDRESS second=$SAW_SECOND second-page=$SAW_SECOND_PAGE copied=$SAW_COPIED"
echo "the first view: stayed=$SAW_STAYED went-back=$SAW_WENT_BACK"
echo "the browser process said: took=$SAW_TOOK"
echo

# Picks which side to blame.
# `packages/domicile-engine/tests/test-webview-history-new-window-guard.sh`
# runs this block directly.
#
# Ordered by dependency: each arm assumes the readings before it held.
FAILURE=""
PASSED=""
if [ "$SAW_DRIVING" != "1" ]; then
  FAILURE="the shell module never ran, so nothing here was ever set up. This \
is the harness: the module did not load, or it threw"
elif [ "$SAW_TWO" != "1" ]; then
  FAILURE="the view never showed /two, so it had nowhere to go back to and \
the call below had nothing to do. That is the guest's navigation, which \
guard-webview-history.sh checks"
elif [ "$NEGATIVE" = "1" ]; then
  if [ "$SAW_ASKED" = "1" ]; then
    FAILURE="the control opened a window: a plain goBack() listed one, so \
what the positive run reads is a window opened for any back, not the call's"
  elif [ "$SAW_WENT_BACK" != "1" ]; then
    FAILURE="the control's goBack() never moved the view to /one, so the \
positive run's view staying on /two is no measurement of the call"
  else
    PASSED="the control is sharp: goBack() on the same view moved it to /one \
and opened no window"
  fi
elif [ "$SAW_ASKED" != "1" ] && [ "$SAW_TOOK" = "1" ]; then
  FAILURE="THE WINDOW WAS MADE AND NEVER LISTED: TakeHistoryStep ran and no \
window reached this document's list. That is DeskWindows::Make's Changed() or \
browserwindowschanged"
elif [ "$SAW_ASKED" != "1" ]; then
  FAILURE="THE CALL OPENED NOTHING: goBackInNewWindow() never reached \
TakeHistoryStep. Look at the element's mojo call, WebViewGuest::OpenHistoryStep \
(which refuses with no back entry or for an app module) and the desk's \
OpenHistoryStep (which needs a shell)"
elif [ "$SAW_ADDRESS" != "1" ]; then
  FAILURE="THE WINDOW WAS OPENED AT THE WRONG ADDRESS: it never said /one, \
the entry one step back. See the reported url above"
elif [ "$SAW_SECOND" != "1" ]; then
  FAILURE="the shell was told and drew nothing: this guard's page made no \
second <webview>. That is guard-webview-history-new-window.js"
elif [ "$SAW_SECOND_PAGE" != "1" ]; then
  FAILURE="A WINDOW IN THE LIST AND NONE ON THE SCREEN: the second view never \
showed /one. The step's navigation never committed, or the page never \
attached to the element"
elif [ "$SAW_COPIED" != "1" ]; then
  FAILURE="THE HISTORY WAS NOT COPIED: the window shows /one with no forward \
entry, as a window opened at its address would. CopyStateFrom in \
TakeHistoryStep is where that comes from"
elif [ "$SAW_STAYED" != "1" ]; then
  FAILURE="THE VIEW MOVED: the window opened, and the view it came from left \
/two. The step must happen only in the copy"
else
  PASSED="goBackInNewWindow() opened a window one step back through a copy \
of the view's history, the shell drew it, and the view stayed on its page"
fi

if [ -n "$PASSED" ]; then
  echo "PASS: $PASSED"
  exit 0
fi

annotate "guard-webview-history-new-window: $FAILURE"
echo "the engine's last words:" >&2
last_words "$ENGINE_LOG" >&2
echo "what the server was asked for:" >&2
tail -20 "$HTTP_LOG" >&2
exit 1
