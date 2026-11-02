#!/usr/bin/env bash
# Asserts the open-popup guard's verdict: which answers pass, and which end
# each failure blames.
#
# Runs the verdict block from `guard-extension-open-popup.sh` itself, as
# `test-extension-tray-guard.sh` does. Also checks what the guard cannot check
# at runtime: its expected id matches the fixture's key, and the fixture's
# answers are the ones the guard reads.
set -u

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
SCRIPTS="$ROOT/packages/domicile-engine/scripts"
GUARD="$SCRIPTS/guard-extension-open-popup.sh"
FIXTURE="$SCRIPTS/guard-extension-open-popup-extension"
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

# Prints pass or fail, not the message, which may be reworded.
verdict() { # $1 MEASURED
  (
    MEASURED="$1"
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

# Whether the failure message contains `$2`; the end it blames matters.
says() { # $1 MEASURED, $2 what the sentence must contain
  case "$(
    MEASURED="$1"
    eval "$BLOCK"
    echo "$FAILURE"
  )" in
  *"$2"*) echo yes ;;
  *) echo no ;;
  esac
}

# MEASURED is "<leg> <sent> <cleared> <clicked> <requested> <answered>", each
# 1 or 0:
#   sent       the stand-in sent the list
#   cleared    the shell saw the fixture's row with its popup cleared
#   clicked    the shell clicked the action
#   requested  the shell heard `extensionpopuprequested` for the fixture's
#              popup (any request, for the control)
#   answered   action.openPopup answered `opened` (`refused`, for the control)
echo "the claim — the fixture opens its popup from action.onClicked"
expect "all five is a pass" "pass" "$(verdict "popup 1 1 1 1 1")"
expect "a list never sent is a failure" "fail" "$(verdict "popup 0 0 0 0 0")"
expect "and blames the control channel" "yes" \
  "$(says "popup 0 0 0 0 0" "control channel")"
expect "a row never cleared is a failure" "fail" "$(verdict "popup 1 0 0 0 0")"
expect "a click never made is a failure" "fail" "$(verdict "popup 1 1 0 0 0")"
expect "no request is a failure" "fail" "$(verdict "popup 1 1 1 0 0")"
expect "and blames the desk's function" "yes" \
  "$(says "popup 1 1 1 0 0" "RegisterDeskFunctions")"
# Chrome's function refuses on a desk and asks the shell nothing, so a request
# with a refusal is the desk's function answering wrong.
expect "a request answered with an error is a failure" "fail" \
  "$(verdict "popup 1 1 1 1 0")"

echo
echo "the control — action.openPopup with no popup set"
expect "no request and Chrome's refusal is the pass" "pass" \
  "$(verdict "control 1 1 1 0 1")"
expect "a request is a failure" "fail" "$(verdict "control 1 1 1 1 1")"
expect "and blames the popup check" "yes" \
  "$(says "control 1 1 1 1 1" "popup on the active tab")"
expect "another answer is a failure" "fail" "$(verdict "control 1 1 1 0 0")"
expect "a list never sent fails the control too" "fail" \
  "$(verdict "control 0 1 1 0 1")"

echo
echo "a run that measured nothing at all"
expect "an empty measurement is a failure" "fail" "$(verdict "")"
expect "and so is a leg nobody runs" "fail" "$(verdict "elephant 1 1 1 1 1")"

echo
echo "the fixture"
ID="$(sed -n 's/^readonly ID="\([a-p]\{32\}\)"$/\1/p' "$GUARD")"
KEY="$(sed -n 's/^ *"key": "\([^"]*\)",$/\1/p' "$FIXTURE/manifest.json")"
MADE="$(printf '%s' "$KEY" | base64 -d 2>/dev/null | sha256sum | cut -c1-32 | tr '0-9a-f' 'a-p')"
expect "the guard names an id" "yes" "$([ -n "$ID" ] && echo yes || echo no)"
expect "and it is the one the fixture's key makes" "$ID" "$MADE"
expect "the fixture answers both words the guard reads" "yes yes" \
  "$(grep -qF 'say("opened")' "$FIXTURE/background.js" && echo yes || echo no) \
$(grep -qF '"refused"' "$FIXTURE/background.js" && echo yes || echo no)"
expect "and refuses on Chrome's words" "yes" \
  "$(grep -qF '"Extension does not have a popup on the active tab."' "$FIXTURE/background.js" &&
    grep -qF '"Extension does not have a popup on the active tab."' \
      "$ROOT/packages/domicile-engine/src/chrome/browser/domicile/domicile_desk_functions.cc" &&
    echo yes || echo no)"

echo
if [ "$FAILED" -eq 0 ]; then
  echo "the open-popup guard's verdict names the right end in every case"
  exit 0
fi
echo "$FAILED case(s) wrong" >&2
exit 1
