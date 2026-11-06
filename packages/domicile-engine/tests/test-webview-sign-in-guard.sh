#!/usr/bin/env bash
# Tests the verdict of `guard-webview-sign-in.sh`: which readings pass and which
# component a failure blames.
#
# The checks are ordered: a request that never reached the shell only means
# something once the server asked to sign in. Key cases:
#
#   - A browser that never asked blames the override: Chrome's own dialog
#     was asked for instead, or nothing was.
#   - A shell answer that never signed the page in fails: the user name and
#     password were lost on the way to the server.
#   - In the control, any report fails: the page needs no sign-in.
#
# Runs the verdict block from the real guard, so moving it fails here.
set -u

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
GUARD="$ROOT/packages/domicile-engine/scripts/guard-webview-sign-in.sh"
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

# Runs the block with every reading at its passing value; each case overrides
# one. Prints "pass", "fail" or "neither", then the failure on the next line.
judge() { # $1 NEGATIVE, then NAME=value overrides
  (
    SAW_SHELL=1
    SAW_LOADED=1
    SAW_CHALLENGED=1
    SAW_ASKED=1
    SAW_HEARD=1
    SAW_ANSWERED=1
    SAW_SETTLED=1
    SAW_SIGNED_IN=1
    SAW_ANY=1
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

verdict() { judge "$@" | head -1; }

blames() { # $1 word, then the args judge takes
  local word="$1"
  shift
  case "$(judge "$@" | tail -n +2)" in
  *"$word"*) echo yes ;;
  *) echo no ;;
  esac
}

# The control loads a page that needs no sign-in, so it hears no request.
control() {
  verdict 1 SAW_CHALLENGED=0 SAW_ASKED=0 SAW_HEARD=0 SAW_ANSWERED=0 \
    SAW_SETTLED=0 SAW_SIGNED_IN=0 SAW_ANY=0 "$@"
}

echo "a run that never got as far as measuring anything"
expect "a shell that never ran is a failure" "fail" "$(verdict 0 SAW_SHELL=0)"
expect "a shell that never ran is a failure in the control" "fail" \
  "$(control SAW_SHELL=0)"
expect "a shell that never ran blames the harness" "yes" \
  "$(blames "harness" 0 SAW_SHELL=0)"
expect "a server that never asked names the guest" "yes" \
  "$(blames "the guest" 0 SAW_CHALLENGED=0)"
expect "an empty window in the control names the guest" "yes" \
  "$(blames "the guest" 1 SAW_LOADED=0 SAW_ANY=0)"

echo
echo "the positive run — the page behind a sign-in"
expect "a request asked, heard, answered and signed in is the pass" "pass" \
  "$(verdict 0)"
expect "a browser that never asked blames the override" "yes" \
  "$(blames "SetCreateOverride" 0 SAW_ASKED=0)"
expect "a shell that never heard blames SignInRequested" "yes" \
  "$(blames "SignInRequested" 0 SAW_HEARD=0)"
expect "an answer that threw is a failure" "fail" \
  "$(verdict 0 SAW_ANSWERED=0)"
expect "an answer the browser never got blames the reply" "yes" \
  "$(blames "domicile_sign_in" 0 SAW_SETTLED=0)"
expect "a page that never signed in blames SetAuth" "yes" \
  "$(blames "SetAuth" 0 SAW_SIGNED_IN=0)"

echo
echo "the control run — a page that needs no sign-in"
expect "hearing nothing is the pass" "pass" "$(control)"
expect "any report is the control's failure" "fail" \
  "$(control SAW_ANY=1)"

echo
if [ "$FAILED" -eq 0 ]; then
  echo "the sign-in guard's verdict names the right end in every case"
  exit 0
fi
echo "$FAILED case(s) wrong" >&2
exit 1
