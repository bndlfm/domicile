#!/usr/bin/env bash
# Drops the turbo cache entries a run neither read nor wrote, so the cache
# turbo-test.yml saves holds one run's entries instead of every entry it ever
# restored.
#
#   turbo-cache-prune.sh mark <cache dir>    # after restoring, before turbo
#   turbo-cache-prune.sh prune <cache dir>   # after turbo
#
# `mark` dates every file to the epoch. A read then moves its access time to
# now (relatime updates an access time older than the file's mtime), and a new
# file is dated now. An entry is `<hash>.tar.zst`, `<hash>-meta.json` and
# `<hash>-manifest.json`; turbo reads only the manifest when the outputs are
# already on disk, so one file read keeps the whole entry.
set -euo pipefail

command="$1" cache="$2"

case "$command" in
  mark)
    mkdir -p "$cache"
    find "$cache" -type f -exec touch -d @0 {} +
    ;;
  prune)
    cd "$cache"
    hashes() { sed 's/[-.].*//' | sort -u; }
    all="$(find . -maxdepth 1 -type f -printf '%f\n' | hashes)"
    used="$(find . -maxdepth 1 -type f -newerat @1 -printf '%f\n' | hashes)"
    comm -23 <(echo "$all") <(echo "$used") | while read -r hash; do
      [ -n "$hash" ] && rm -f "$hash".* "$hash"-*
    done
    echo "kept $(grep -c . <<<"$used") of $(grep -c . <<<"$all") turbo cache entries"
    ;;
  *)
    echo "usage: $0 mark|prune <cache dir>" >&2
    exit 2
    ;;
esac
