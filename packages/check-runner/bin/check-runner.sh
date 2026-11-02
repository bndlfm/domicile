#!/usr/bin/env bash
# Runs each check it is given and reports each as passed, failed or skipped.
# See `src/report.sh` for the verdicts and the variables that change them.
#
#   check-runner [--jobs N] tests/*.sh
#
# One at a time by default, because checks may share fixed paths such as
# sockets. `--jobs N` runs up to N at once, for checks that share nothing; a
# check with a `# check-runner: alone` line still runs by itself, after the
# rest. Verdicts print in the order the checks were given.
set -u

. "$(dirname "$(realpath "$0")")/../src/report.sh"

JOBS=1
if [ "${1:-}" = --jobs ]; then
  JOBS="$2"
  shift 2
fi

report_start
if [ "$JOBS" -eq 1 ]; then
  for script in "$@"; do
    run "$(basename "$script" .sh)" "$script"
  done
else
  together=(); alone=()
  for script in "$@"; do
    if grep -qx '# check-runner: alone' "$script"; then
      alone+=("$script")
    else
      together+=("$script")
    fi
  done
  run_together "$JOBS" "${together[@]}"
  for script in "${alone[@]}"; do
    run "$(basename "$script" .sh)" "$script"
  done
fi
report_end
