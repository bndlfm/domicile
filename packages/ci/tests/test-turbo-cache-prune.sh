#!/usr/bin/env bash
# Asserts that `turbo-cache-prune.sh` keeps only the turbo cache entries a run
# read or wrote.
#
# turbo-test.yml saves the cache after each run. Without pruning it would keep
# every entry ever restored, and grow with each run.
set -u

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
PRUNE_SH="$ROOT/.github/scripts/turbo-cache-prune.sh"
[ -x "$PRUNE_SH" ] || { echo "no $PRUNE_SH" >&2; exit 1; }

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

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

CACHE="$WORK/cache"
mkdir -p "$CACHE"
entry() { # hash
  for file in "$1.tar.zst" "$1-meta.json" "$1-manifest.json"; do
    echo "$1" >"$CACHE/$file"
  done
}
left() { (cd "$CACHE" && ls | sed 's/[-.].*//' | sort -u | tr '\n' ' '); }

# As restored: one entry turbo will restore from, one it will find already on
# disk (it reads only the manifest), and one this run never needs.
entry aaaa
entry bbbb
entry cccc
"$PRUNE_SH" mark "$CACHE"

cat "$CACHE/aaaa.tar.zst" >/dev/null
cat "$CACHE/bbbb-manifest.json" >/dev/null
entry dddd

said="$("$PRUNE_SH" prune "$CACHE")"
expect "keeps what the run read or wrote, every file of each" \
  "aaaa bbbb dddd " "$(left)"
expect "keeps all three files of an entry" 3 "$(ls "$CACHE"/bbbb* | wc -l)"
expect "says what it kept" "kept 3 of 4 turbo cache entries" "$said"

expect "marking a cache that was never restored creates it" "yes" \
  "$("$PRUNE_SH" mark "$WORK/none" && [ -d "$WORK/none" ] && echo yes)"

[ "$FAILED" -eq 0 ] && { echo "all ok"; exit 0; }
echo "$FAILED failed"; exit 1
