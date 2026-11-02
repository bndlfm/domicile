#!/usr/bin/env bash
# Checks that CHROMIUM_VERSION is the version of the revision CHROMIUM_PIN
# names, by reading that revision's chrome/VERSION from GitHub's mirror. The
# website shows both, so a repin that forgets the version fails here.
set -u

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
ENGINE="$ROOT/packages/domicile-engine"
PIN="$(tail -1 "$ENGINE/CHROMIUM_PIN")"
URL="https://raw.githubusercontent.com/chromium/chromium/$PIN/chrome/VERSION"

if ! UPSTREAM="$(curl -fsS --max-time 30 "$URL")"; then
  echo "SKIP: could not read $URL"
  exit 77
fi
EXPECTED="$(printf '%s\n' "$UPSTREAM" | sed -n 's/^[A-Z]*=//p' | paste -sd.)"
ACTUAL="$(cat "$ENGINE/CHROMIUM_VERSION" 2>/dev/null)"

if [ "$ACTUAL" = "$EXPECTED" ]; then
  echo "PASS: CHROMIUM_VERSION is $EXPECTED, the pin's"
else
  echo "FAIL: CHROMIUM_VERSION is '$ACTUAL', but $PIN is Chromium $EXPECTED. Write $EXPECTED to packages/domicile-engine/CHROMIUM_VERSION."
  exit 1
fi
