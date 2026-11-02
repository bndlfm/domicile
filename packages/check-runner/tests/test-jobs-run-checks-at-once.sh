#!/usr/bin/env bash
# Checks `check-runner --jobs N`.
#
# - Up to N checks run at once.
# - Verdicts print in the order the checks were given, whatever order they
#   finish in.
# - A check marked `# check-runner: alone` runs after the others, by itself,
#   for checks that change files other checks read.
# - Without `--jobs`, checks run one at a time.
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RUNNER="$ROOT/bin/check-runner.sh"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

FAILED=0
ok() { printf '  ok    %s\n' "$1"; }
fail() { printf '  FAIL  %s\n    %s\n' "$1" "$2"; FAILED=$((FAILED + 1)); }
expect() { # what, want, got
  if [ "$3" = "$2" ]; then
    ok "$1"
  else
    fail "$1" "wanted: $(printf '%q' "$2")  got: $(printf '%q' "$3")"
  fi
}

mkdir -p "$WORK/checks" "$WORK/state"
standin() { # name, body
  printf '#!/usr/bin/env bash\nSTATE=%q\n%s\n' "$WORK/state" "$2" >"$WORK/checks/$1.sh"
  chmod +x "$WORK/checks/$1.sh"
}

# Each waits for the other's mark, so both pass only when they run at once.
standin check-1-meets-check-2 '
touch "$STATE/1-busy"
for _ in $(seq 1 50); do [ -e "$STATE/2-busy" ] && break; sleep 0.1; done
[ -e "$STATE/2-busy" ] || exit 1
sleep 0.5
rm "$STATE/1-busy"
echo "PASS: met check 2"'
standin check-2-meets-check-1 '
touch "$STATE/2-busy"
for _ in $(seq 1 50); do [ -e "$STATE/1-busy" ] && break; sleep 0.1; done
[ -e "$STATE/1-busy" ] || exit 1
sleep 0.5
rm "$STATE/2-busy"'
# Listed before the others but marked, so it must find nothing else running.
standin check-0-runs-alone '
# check-runner: alone
ls "$STATE"/*-busy >/dev/null 2>&1 && exit 1
echo "PASS: ran alone"'

check() { # runner arguments...
  env -u DOMICILE_CHECK_STRICT -u DOMICILE_CHECK_ALLOW_SKIP \
    DOMICILE_CHECK_LOG_DIR="$WORK/logs" "$RUNNER" "$@" \
    >"$WORK/out" 2>&1
}

echo "check-runner --jobs"

check --jobs 2 "$WORK"/checks/check-1-*.sh "$WORK"/checks/check-2-*.sh "$WORK"/checks/check-0-*.sh
expect "checks run at once and pass" "0" "$?"
expect "verdicts print in the order given, the alone check last" \
  "$(printf 'check-1-meets-check-2 ok\n    PASS: met check 2\ncheck-2-meets-check-1 ok\ncheck-0-runs-alone ok\n    PASS: ran alone')" \
  "$(sed -n '/^  check-\|^    /p' "$WORK/out" | sed 's/^  \(check-[^ ]*\) */\1 /')"
expect "the tally counts every check" "yes" \
  "$(grep -qxF '== 3 passed, 0 failed, 0 skipped ==' "$WORK/out" && echo yes || echo no)"

check --jobs 2 "$WORK"/checks/check-0-*.sh "$WORK"/checks/check-1-*.sh "$WORK"/checks/check-2-*.sh
expect "an alone check listed first still runs by itself" "0" "$?"

echo "check-runner without --jobs"

check "$WORK"/checks/check-1-*.sh "$WORK"/checks/check-2-*.sh
expect "checks run one at a time" "1" "$?"

[ "$FAILED" -eq 0 ] && { echo "all ok"; exit 0; }
echo "$FAILED failed"; exit 1
