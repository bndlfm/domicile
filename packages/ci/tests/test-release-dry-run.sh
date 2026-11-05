#!/usr/bin/env bash
# Tests `release-dry-run.sh`, which names the dry run whose packages a release
# of the same commit reuses.
#
# Uses a fake `gh` that answers the artifacts query from a file.
set -u

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
SCRIPT="$ROOT/.github/scripts/release-dry-run.sh"
[ -x "$SCRIPT" ] || { echo "no $SCRIPT" >&2; exit 1; }
command -v jq >/dev/null 2>&1 || { echo "  SKIP: no jq"; exit 77; }

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

FAILED=0
expect() {
  if [ "$3" = "$2" ]; then
    printf '  ok    %s\n' "$1"
  else
    printf '  FAIL  %s\n    wanted: %s\n    got:    %s\n' "$1" "$2" "$3"
    FAILED=$((FAILED + 1))
  fi
}

mkdir "$WORK/bin"
cat >"$WORK/bin/gh" <<'GH'
#!/usr/bin/env bash
# `gh api <path> --jq <filter>`
echo "$2" >>"$FAKE_GH_CALLS"
jq -r "$4" "$FAKE_GH_ANSWER"
GH
chmod +x "$WORK/bin/gh"
export PATH="$WORK/bin:$PATH" GITHUB_REPOSITORY=o/r FAKE_GH_CALLS="$WORK/calls" FAKE_GH_ANSWER="$WORK/answer"

answer() { printf '%s' "$1" >"$WORK/answer"; }

answer '{"artifacts":[{"expired":false,"workflow_run":{"id":7}},{"expired":false,"workflow_run":{"id":5}}]}'
expect "names the newest dry run of the commit" 7 "$("$SCRIPT" find abc)"
expect "asks for the commit's marker" \
  "repos/o/r/actions/artifacts?name=release-dry-run-abc" "$(tail -1 "$WORK/calls")"

answer '{"artifacts":[{"expired":true,"workflow_run":{"id":7}},{"expired":false,"workflow_run":{"id":5}}]}'
expect "skips an expired one" 5 "$("$SCRIPT" find abc)"

answer '{"artifacts":[]}'
expect "prints nothing when there is none" "" "$("$SCRIPT" find abc)"

expect "names the marker" release-dry-run-abc "$("$SCRIPT" marker abc)"

"$SCRIPT" find >/dev/null 2>&1
expect "wants a commit" 2 "$?"

[ "$FAILED" -eq 0 ] || { echo "$FAILED failed"; exit 1; }
echo "all ok"
