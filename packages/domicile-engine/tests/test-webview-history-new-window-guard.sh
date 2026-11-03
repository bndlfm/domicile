#!/usr/bin/env bash
# Tests the verdict of `guard-webview-history-new-window.sh`: which readings
# pass and which component a failure blames.
#
# Runs the verdict block from the real guard, so moving it fails here.
set -u

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
GUARD="$ROOT/packages/domicile-engine/scripts/guard-webview-history-new-window.sh"
[ -f "$GUARD" ] || {
  echo "no guard at $GUARD" >&2
  exit 1
}

# From `FAILURE=""` to the column-zero `fi` that ends the decision.
BLOCK="$(awk '/^FAILURE=""$/,/^fi$/' "$GUARD")"
[ -n "$BLOCK" ] || {
  echo "no verdict block in $GUARD — its markers moved. Fix this test with it." >&2
  exit 1
}

FAILED=0
expect() {
  local what="$1" want="$2" got="$3"
  if [ "$got" = "$want" ]; then
    printf '  ok    %s\n' "$what"
  else
    printf '  FAIL  %s\n    wanted: %s\n    got:    %s\n' "$what" "$want" "$got"
    FAILED=$((FAILED + 1))
  fi
}

# Runs the block on the positive run's passing readings, with each `NAME=value`
# override, and prints `pass`, `fail` or `neither`, then the failure message.
run_block() { # $1 NEGATIVE, then overrides
  (
    SAW_DRIVING=1
    SAW_TWO=1
    SAW_ASKED=1
    SAW_ADDRESS=1
    SAW_SECOND=1
    SAW_SECOND_PAGE=1
    SAW_COPIED=1
    SAW_STAYED=1
    SAW_WENT_BACK=0
    SAW_TOOK=1
    NEGATIVE="$1"
    shift
    for override in "$@"; do
      eval "$override"
    done
    eval "$BLOCK"
    if [ -n "$PASSED" ]; then
      echo "pass"
    elif [ -n "$FAILURE" ]; then
      echo "fail"
    else
      echo "neither"
    fi
    echo "$FAILURE"
  )
}

verdict() { run_block "$@" | head -1; }

blames() { # $1 word, then the args run_block takes
  local word="$1"
  shift
  case "$(run_block "$@" | tail -n +2)" in
  *"$word"*) echo yes ;;
  *) echo no ;;
  esac
}

# The control's readings: goBack() moves the view and opens no window.
CONTROL=(SAW_ASKED=0 SAW_ADDRESS=0 SAW_SECOND=0 SAW_SECOND_PAGE=0
  SAW_COPIED=0 SAW_STAYED=0 SAW_WENT_BACK=1 SAW_TOOK=0)

echo "a run that never got as far as measuring anything"
expect "a module that never ran is a failure" "fail" \
  "$(verdict 0 SAW_DRIVING=0)"
expect "a module that never ran is a failure in the control too" "fail" \
  "$(verdict 1 "${CONTROL[@]}" SAW_DRIVING=0)"
expect "a module that never ran blames the harness" "yes" \
  "$(blames "harness" 0 SAW_DRIVING=0)"
expect "no second page is a failure in both runs" "fail fail" \
  "$(verdict 0 SAW_TWO=0) $(verdict 1 "${CONTROL[@]}" SAW_TWO=0)"

echo
echo "the positive run"
expect "everything arriving is the pass" "pass" "$(verdict 0)"
expect "a window made and never listed blames the list" "yes" \
  "$(blames "NEVER LISTED" 0 SAW_ASKED=0 SAW_ADDRESS=0 SAW_SECOND=0 \
    SAW_SECOND_PAGE=0 SAW_COPIED=0)"
expect "no window at all blames the call" "yes" \
  "$(blames "OPENED NOTHING" 0 SAW_ASKED=0 SAW_ADDRESS=0 SAW_SECOND=0 \
    SAW_SECOND_PAGE=0 SAW_COPIED=0 SAW_TOOK=0)"
expect "a window at the wrong address says so" "yes" \
  "$(blames "WRONG ADDRESS" 0 SAW_ADDRESS=0)"
expect "a shell that drew nothing blames this guard's page" "yes" \
  "$(blames "guard-webview-history-new-window.js" 0 SAW_SECOND=0 \
    SAW_SECOND_PAGE=0 SAW_COPIED=0)"
expect "a second view with no page is a failure" "yes" \
  "$(blames "NONE ON THE SCREEN" 0 SAW_SECOND_PAGE=0 SAW_COPIED=0)"
# The case that separates a copy from opening the entry's address.
expect "a window with no forward entry blames the copy" "yes" \
  "$(blames "NOT COPIED" 0 SAW_COPIED=0)"
expect "a view that moved is a failure" "yes" \
  "$(blames "THE VIEW MOVED" 0 SAW_STAYED=0 SAW_WENT_BACK=1)"

echo
echo "the control"
expect "goBack() moving the view and opening nothing is the pass" "pass" \
  "$(verdict 1 "${CONTROL[@]}")"
expect "a window in the control is a failure" "yes" \
  "$(blames "for any back" 1 "${CONTROL[@]}" SAW_ASKED=1)"
expect "a control that never moved is a failure" "yes" \
  "$(blames "no measurement" 1 "${CONTROL[@]}" SAW_WENT_BACK=0)"

echo
if [ "$FAILED" -eq 0 ]; then
  echo "the history-in-a-new-window guard's verdict names the right end in every case"
  exit 0
fi
echo "$FAILED case(s) wrong" >&2
exit 1
