#!/usr/bin/env bash
# Checks that the series drops Chromium's "VMware is buggy on Linux" GPU
# blocklist entry.
#
# Entry 176 of `gpu/config/software_rendering_list.json` turns off the GPU on
# every VMware card (vendor 0x15ad), which puts the whole desktop on the CPU
# in a VMware guest with 3D on, where GNOME draws on the card. Guards the
# entry coming back, as it would on a pin roll that rewrites the list.
#
# Reads `patches/` instead of a Chromium tree, so it runs in the shell group.
set -u

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
PATCHES="$ROOT/packages/domicile-engine/patches"
[ -d "$PATCHES" ] || { echo "no patch series at $PATCHES" >&2; exit 1; }

# Lines the series removes from the software rendering list.
removed="$(awk '
  /^diff --git a\// { in_file = ($0 ~ /gpu\/config\/software_rendering_list\.json$/); next }
  in_file && /^-[^-]/ { print }
' "$PATCHES"/*.patch)"

case "$removed" in
  (*'"description": "VMware is buggy on Linux"'*)
    printf '  ok    %s\n' "a VMware card is not blocklisted" ;;
  (*)
    printf '  FAIL  %s\n    %s\n' "a VMware card is not blocklisted" \
      "entry 176 still turns off the GPU on every VMware card"
    exit 1 ;;
esac
