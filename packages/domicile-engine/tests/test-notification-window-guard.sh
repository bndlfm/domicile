#!/usr/bin/env bash
# Tests the verdict of `guard-notification-window.sh`: which readings pass and
# which end a failure blames.
#
# Runs the verdict block from the real guard, so moving it fails here.
set -u

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
GUARD="$ROOT/packages/domicile-engine/scripts/guard-notification-window.sh"
[ -f "$GUARD" ] || {
  echo "no guard at $GUARD" >&2
  exit 1
}

BLOCK="$(awk '/^FAILURE=""$/,/^esac$/' "$GUARD")"
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

verdict() { # $1 MEASURED
  (
    MEASURED="$1"
    HINT="x-domicile-browser-window"
    eval "$BLOCK"
    if [ -n "$PASSED" ]; then
      echo "pass"
    elif [ -n "$FAILURE" ]; then
      echo "fail"
    else
      echo "neither"
    fi
  )
}

says() { # $1 MEASURED, $2 what the failure must contain
  (
    MEASURED="$1"
    HINT="x-domicile-browser-window"
    eval "$BLOCK"
    case "$FAILURE" in
    *"$2"*) echo yes ;;
    *) echo no ;;
    esac
  )
}

echo "the claim — a page in an app window notifies"
expect "naming its window passes" pass "$(verdict "window named")"
expect "naming no window fails" fail "$(verdict "window unnamed")"
expect "naming no window blames the patch" yes "$(says "window unnamed" "patch 0172")"
expect "naming another window fails" fail "$(verdict "window misnamed")"
expect "never notifying fails" fail "$(verdict "window silent")"
expect "never notifying blames the harness" yes "$(says "window silent" "the harness")"

echo "the control — the shell notifies itself"
expect "naming no window passes" pass "$(verdict "shell unnamed")"
expect "naming a window fails" fail "$(verdict "shell named")"
expect "never notifying fails" fail "$(verdict "shell silent")"

echo "anything else"
expect "an unknown reading fails" fail "$(verdict "window ")"

if [ "$FAILED" -gt 0 ]; then
  echo "$FAILED failed"
  exit 1
fi
echo "all ok"
