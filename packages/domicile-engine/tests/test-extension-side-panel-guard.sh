#!/usr/bin/env bash
# Asserts the side panel guard's verdict: which answers pass, and which end
# each failure blames.
#
# Runs the verdict block from `guard-extension-side-panel.sh` itself, as
# `test-extension-open-popup-guard.sh` does. Also checks what the guard cannot
# check at runtime: its expected id matches the fixture's key, and the
# fixture's answers are the ones the guard reads.
set -u

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
SCRIPTS="$ROOT/packages/domicile-engine/scripts"
GUARD="$SCRIPTS/guard-extension-side-panel.sh"
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
#   requested  the shell was given a popup window showing the fixture's
#              side panel at its size (any window or request, for the control)
#   answered   sidePanel.open answered `opened` (`refused`, for the control)
echo "the claim — the fixture opens its side panel from action.onClicked"
expect "all five is a pass" "pass" "$(verdict "panel 1 1 1 1 1")"
expect "a list never sent is a failure" "fail" "$(verdict "panel 0 0 0 0 0")"
expect "and blames the control channel" "yes" \
  "$(says "panel 0 0 0 0 0" "control channel")"
expect "a row never cleared is a failure" "fail" "$(verdict "panel 1 0 0 0 0")"
expect "a click never made is a failure" "fail" "$(verdict "panel 1 1 0 0 0")"
expect "no request is a failure" "fail" "$(verdict "panel 1 1 1 0 0")"
expect "and blames the desk's function" "yes" \
  "$(says "panel 1 1 1 0 0" "RegisterDeskFunctions")"
expect "a request answered with an error is a failure" "fail" \
  "$(verdict "panel 1 1 1 1 0")"
expect "the open-popup guard's leg is not this guard's" "fail" \
  "$(verdict "popup 1 1 1 1 1")"

echo
echo "the control — sidePanel.open with the side panel turned off"
expect "no request and Chrome's refusal is the pass" "pass" \
  "$(verdict "control 1 1 1 0 1")"
expect "a request is a failure" "fail" "$(verdict "control 1 1 1 1 1")"
expect "and blames the options check" "yes" \
  "$(says "control 1 1 1 1 1" "panel's options")"
expect "another answer is a failure" "fail" "$(verdict "control 1 1 1 0 0")"

echo
echo "a run that measured nothing at all"
expect "an empty measurement is a failure" "fail" "$(verdict "")"

echo
echo "the fixture"
ID="$(sed -n 's/^readonly ID="\([a-p]\{32\}\)"$/\1/p' "$GUARD")"
KEY="$(sed -n 's/^ *"key": "\([^"]*\)",$/\1/p' "$FIXTURE/manifest.json")"
MADE="$(printf '%s' "$KEY" | base64 -d 2>/dev/null | sha256sum | cut -c1-32 | tr '0-9a-f' 'a-p')"
expect "the guard names an id" "yes" "$([ -n "$ID" ] && echo yes || echo no)"
expect "and it is the one the fixture's key makes" "$ID" "$MADE"
expect "the fixture has the side panel the guard expects" "yes" \
  "$(grep -qF '"default_path": "panel.html"' "$FIXTURE/manifest.json" &&
    grep -qF '/panel.html"' "$GUARD" && echo yes || echo no)"
FUNCTIONS="$ROOT/packages/domicile-engine/src/chrome/browser/domicile/domicile_desk_functions.cc"
expect "the desk asks for no size, so the shell tiles a side panel" "yes" \
  "$(grep -qF 'panel, 0, 0);' "$FUNCTIONS" && echo yes || echo no)"
expect "which the guard expects" "yes" \
  "$(grep -qF 'readonly PANEL_SIZE="0x0"' "$GUARD" && echo yes || echo no)"
expect "and refuses on Chrome's words" "yes" \
  "$(grep -qF '"No active side panel for windowId: "' "$FIXTURE/background.js" &&
    grep -qF '"No active side panel for windowId: %d"' \
      "$ROOT/packages/domicile-engine/src/chrome/browser/domicile/domicile_desk_functions.cc" &&
    echo yes || echo no)"

echo
if [ "$FAILED" -eq 0 ]; then
  echo "the side panel guard's verdict names the right end in every case"
  exit 0
fi
echo "$FAILED case(s) wrong" >&2
exit 1
