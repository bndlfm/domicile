#!/usr/bin/env bash
# The dry run whose packages a release of the same commit reuses.
#
#   release-dry-run.sh marker <commit>   the artifact a passed dry run uploads
#   release-dry-run.sh find <commit>     the newest such run's id, or nothing
#
# A dry run uploads its marker only after every step passed, so a run that
# has one built, installed and checked the packages this release would build.
set -u

usage() { echo "usage: $(basename "$0") <marker|find> <commit>" >&2; exit 2; }
[ -n "${2:-}" ] || usage
marker="release-dry-run-$2"

case "$1" in
  marker) echo "$marker" ;;
  find)
    : "${GITHUB_REPOSITORY:?}"
    # Newest first.
    gh api "repos/$GITHUB_REPOSITORY/actions/artifacts?name=$marker" \
      --jq '[.artifacts[] | select(.expired | not)][0].workflow_run.id // empty'
    ;;
  *) usage ;;
esac
