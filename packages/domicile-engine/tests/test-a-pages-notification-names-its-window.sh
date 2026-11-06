#!/usr/bin/env bash
# Checks that a page's notification names the browser window the page is in.
#
# A page's Web Notification reached the desktop named only by its site, so the
# shell could not tell a site's app window from its other pages.
#
# Reads the patches, not a Chromium tree, so it runs in the shell group.
# `guard-notification-window.sh` checks the same on a built engine.
set -u

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
ENGINE="$ROOT/packages/domicile-engine"
PATCHES="$ENGINE/patches"
[ -d "$PATCHES" ] || { echo "no patch series at $PATCHES" >&2; exit 1; }

FAILED=0
ok()   { printf '  ok    %s\n' "$1"; }
fail() { printf '  FAIL  %s\n    %s\n' "$1" "$2"; FAILED=$((FAILED + 1)); }

BRIDGE="$(grep -al '^+++ b/chrome/browser/notifications/notification_platform_bridge_linux.cc' "$PATCHES"/*.patch)"
# shellcheck disable=SC2086 # one path per patch
if [ -n "$BRIDGE" ] && grep -aq '^+.*"x-domicile-browser-window"' $BRIDGE &&
  grep -aq '^+.*domicile::FindNotificationWindow(' $BRIDGE; then
  ok "the bridge sends the page's browser window as a hint"
else
  fail "the bridge sends the page's browser window as a hint" \
    "no patch has NotificationPlatformBridgeLinuxImpl send x-domicile-browser-window from FindNotificationWindow"
fi

if grep -q 'SetNotificationWindowFinder(' "$ENGINE/src/chrome/browser/domicile/domicile_browser_windows.cc"; then
  ok "the browser windows set the finder"
else
  fail "the browser windows set the finder" \
    "domicile_browser_windows.cc never calls SetNotificationWindowFinder, so every notification names no window"
fi

if grep -qx '  guard-notification-window' "$ENGINE/scripts/run-checks.sh"; then
  ok "test:engine runs guard-notification-window.sh"
else
  fail "test:engine runs guard-notification-window.sh" \
    "run-checks.sh does not list guard-notification-window"
fi

if [ "$FAILED" -gt 0 ]; then
  echo "$FAILED failed"
  exit 1
fi
echo "all ok"
