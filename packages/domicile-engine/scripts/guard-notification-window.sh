#!/usr/bin/env bash
# Checks that a page's notification names the browser window the page is in
# (patch 0172).
#
#   nix develop .#full --command \
#     ./packages/domicile-engine/scripts/guard-notification-window.sh /build/chromium/src
#
# WHY THIS EXISTS. A page's Web Notification reached the desktop named only by
# its site, so the shell could not tell a site's app window from its other
# pages. Manganese clears what Gmail's page in a Gmail inbox's window notifies,
# since the inbox notifies the same mail, and must not clear Gmail's
# notifications from any other window.
#
# Headless, on a private bus. guard-notification-window-server.py is the
# notification server, and serves a page that notifies. The shell opens that
# page in an app window. Passes when the server's Notify carries
# `x-domicile-browser-window` with the id the shell lists the window by.
#
# NEGATIVE=1 is the control: the shell notifies itself, which no browser
# window's page sent. Its Notify must carry no window, so the claim's hint is
# the window's and not one sent with every notification.
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
  annotate "guard-notification-window: no path to chromium/src was given"
  exit 1
fi

NEGATIVE="${NEGATIVE:-0}"

# How long the engine has to start, open the window and notify.
FOR_SECONDS="${FOR_SECONDS:-60}"

OUT="${OUT:-out/Domicile}"
# Not any other guard's paths: CI runs the guards in one job.
BROKER="${BROKER:-/tmp/domicile-notification-window-broker}"
PROFILE="${PROFILE:-/tmp/domicile-notification-window-profile}"
BUS="${BUS:-/tmp/domicile-notification-window-bus}"
BUS_CONFIG="${BUS_CONFIG:-/tmp/domicile-notification-window-bus.conf}"
SERVER_LOG="${SERVER_LOG:-/tmp/domicile-notification-window-server.log}"
ENGINE_LOG="${ENGINE_LOG:-/tmp/domicile-notification-window-engine.log}"

HINT="x-domicile-browser-window"

STARTED=()
cleanup() {
  if [ ${#STARTED[@]} -gt 0 ]; then
    kill "${STARTED[@]}" 2>/dev/null
  fi
  remove_profile "$PROFILE"
  rm -f "$BUS" "$BUS_CONFIG"
}
trap cleanup EXIT

[ -x "$CHROMIUM/$OUT/chrome" ] || {
  annotate "guard-notification-window: no engine at $CHROMIUM/$OUT/chrome; build it with ./packages/domicile-engine/scripts/build.sh"
  exit 1
}
for tool in dbus-daemon python3; do
  command -v "$tool" >/dev/null || {
    skip "guard-notification-window: no $tool here; run inside nix develop .#full"
    exit 77
  }
done

# No <servicedir>: a notification daemon installed on the host must not be
# started in the server's place.
cat >"$BUS_CONFIG" <<EOF
<!DOCTYPE busconfig PUBLIC "-//freedesktop//DTD D-Bus Bus Configuration 1.0//EN"
 "http://www.freedesktop.org/standards/dbus/1.0/busconfig.dtd">
<busconfig>
  <type>session</type>
  <listen>unix:path=$BUS</listen>
  <auth>EXTERNAL</auth>
  <policy context="default">
    <allow send_destination="*"/>
    <allow own="*"/>
    <allow receive_sender="*"/>
  </policy>
</busconfig>
EOF

wait_for_line() { # $1 seconds, $2 pattern, $3 file
  for _ in $(seq 1 $(($1 * 4))); do
    grep -qF "$2" "$3" 2>/dev/null && return 0
    sleep 0.25
  done
  return 1
}

# 1. The bus, and the server on it.
rm -f "$BUS"
dbus-daemon --config-file="$BUS_CONFIG" --nofork --nopidfile >/dev/null 2>&1 &
STARTED+=($!)
for _ in $(seq 1 40); do
  [ -S "$BUS" ] && break
  sleep 0.25
done
[ -S "$BUS" ] || {
  annotate "guard-notification-window: the private bus never came up at $BUS"
  exit 1
}
export DBUS_SESSION_BUS_ADDRESS="unix:path=$BUS"

rm -f "$SERVER_LOG"
python3 "$SCRIPTS/guard-notification-window-server.py" --port 0 >"$SERVER_LOG" 2>&1 &
STARTED+=($!)
wait_for_line 15 "serving" "$SERVER_LOG"
PORT="$(served_port "$SERVER_LOG")" || {
  annotate_from "guard-notification-window: the server never said which port it took" "$SERVER_LOG"
  tail -20 "$SERVER_LOG" >&2
  exit 1
}
SITE="http://127.0.0.1:$PORT"
wait_for_line 15 "took org.freedesktop.Notifications" "$SERVER_LOG" || {
  annotate_from "guard-notification-window: the server never took org.freedesktop.Notifications" "$SERVER_LOG"
  exit 1
}

# 2. The engine. The page's origin may notify: a site's own setting, which
#    patch 0105's reset of the default to ask leaves alone.
fresh_broker
rm -rf "$PROFILE"
mkdir -p "$PROFILE/Default"
printf '{"profile":{"content_settings":{"exceptions":{"notifications":{"%s,*":{"setting":1}}}}}}\n' \
  "$SITE" >"$PROFILE/Default/Preferences"

if [ "$NEGATIVE" = "1" ]; then
  LEG="shell"
  SUMMARY="from-the-shell"
else
  LEG="window"
  SUMMARY="from-a-window"
fi

rm -f "$ENGINE_LOG"
"$CHROMIUM/$OUT/chrome" \
  --ozone-platform=headless \
  --disable-gpu \
  --app="domicile://shell/?leg=$LEG&site=$SITE" \
  --domicile-shell-root="$SCRIPTS" \
  --domicile-shell-module="guard-notification-window.js" \
  --no-sandbox --password-store=basic --no-first-run --disable-component-update \
  --user-data-dir="$PROFILE" \
  --enable-logging=stderr --log-level=0 \
  --domicile-broker-socket="$BROKER" >"$ENGINE_LOG" 2>&1 &
STARTED+=($!)

# 3. The reading: what the Notify for the leg's notification named.
#
#   named     it named the window the shell lists the page's window by
#   misnamed  it named another
#   unnamed   it named none
#   silent    the server was never sent it
if ! wait_for_line "$FOR_SECONDS" "NOTIFY $SUMMARY " "$SERVER_LOG"; then
  READING="silent"
else
  NAMED="$(sed -n "s/^NOTIFY $SUMMARY .*\"$HINT\": \"\([^\"]*\)\".*$/\1/p" "$SERVER_LOG" | head -1)"
  LISTED="$(sed -n 's/.*GUARD window id=\([^" ]*\).*/\1/p' "$ENGINE_LOG" | head -1)"
  if [ -z "$NAMED" ]; then
    READING="unnamed"
  elif [ "$NAMED" = "$LISTED" ]; then
    READING="named"
  else
    READING="misnamed"
  fi
fi
MEASURED="$LEG $READING"

echo
echo "measured: $MEASURED"

# packages/domicile-engine/tests/test-notification-window-guard.sh runs this block directly.
FAILURE=""
PASSED=""
case "$MEASURED" in
"window named")
  PASSED="a page's notification names the browser window it is in, so the \
shell can tell an inbox's window from the site's other pages"
  ;;
"window unnamed")
  FAILURE="a page in an app window notified without $HINT, so the shell \
cannot tell which window it came from (patch 0172)"
  ;;
"window misnamed")
  FAILURE="a page's notification named a browser window other than the one \
the shell lists the page in, so the shell would clear the wrong window's"
  ;;
"window silent")
  FAILURE="the page's notification never reached the server: the window did \
not open, the site was not allowed to notify, or the bridge did not connect. \
This is the harness, not the hint"
  ;;
"shell unnamed")
  PASSED="the control is sharp: the shell's own notification names no \
browser window, so the claim's hint is the page's window"
  ;;
"shell named" | "shell misnamed")
  FAILURE="the shell's own notification named a browser window, so $HINT is \
not the window a page is in"
  ;;
"shell silent")
  FAILURE="the shell's notification never reached the server, so the control \
measured nothing. This is the harness"
  ;;
*)
  FAILURE="there is no measurement here of any kind ($MEASURED)"
  ;;
esac

if [ -n "$PASSED" ]; then
  echo "PASS: $PASSED"
  exit 0
fi

annotate "guard-notification-window: $FAILURE"
echo "the engine's last words ($ENGINE_LOG):" >&2
last_words "$ENGINE_LOG" >&2
echo "what the server heard ($SERVER_LOG):" >&2
tail -20 "$SERVER_LOG" >&2
exit 1
