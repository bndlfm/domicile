#!/usr/bin/env bash
# Checks that the desktop GPU sandbox lets Mesa open a card handed over after
# it is up.
#
# On a tty every card reaches the GPU process after its sandbox starts, so
# gbm_create_device runs inside it. Desktop Linux's broker allows only
# /dev/dri/card*, and refused Mesa's GBM backend with EACCES on a VMware card
# that GNOME drew on with 3D. Guards:
#   - the desktop permissions leaving out Mesa's files
#   - libgbm's own directory, which holds `gbm/dri_gbm.so` on Debian, Fedora
#     and Arch, not being found
#   - the render nodes and the card's sysfs entry staying refused
#   - readlink staying off on the desktop, which libdrm needs in sysfs
#
# Reads `patches/` instead of a Chromium tree, so it runs in the shell group.
set -u

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
PATCHES="$ROOT/packages/domicile-engine/patches"
[ -d "$PATCHES" ] || { echo "no patch series at $PATCHES" >&2; exit 1; }

FAILED=0
ok()   { printf '  ok    %s\n' "$1"; }
fail() { printf '  FAIL  %s\n    %s\n' "$1" "$2"; FAILED=$((FAILED + 1)); }

# Lines the series adds to the GPU process's pre-sandbox hook.
added="$(awk '
  /^diff --git a\// { in_file = ($0 ~ /content\/common\/gpu_pre_sandbox_hook_linux\.cc$/); next }
  in_file && /^\+[^+]/ { print }
' "$PATCHES"/*.patch)"
in_hook() { case "$added" in (*"$1"*) return 0 ;; (*) return 1 ;; esac }

check() {
  if in_hook "$2"; then ok "$1"; else fail "$1" "$3"; fi
}

check "the desktop sandbox lets Mesa's files through" \
  'AddDomicileMesaGpuPermissions(&permissions);' \
  "FilePermissionsForGpu adds no Mesa permissions on the desktop"
check "libgbm's directory is found from libgbm itself" \
  'dladdr(dlsym(gbm, "gbm_create_device"), &info)' \
  "nothing finds the directory that holds gbm/dri_gbm.so"
check "the GBM and driver paths Mesa reads are honored" \
  '"GBM_BACKENDS_PATH", "LIBGL_DRIVERS_PATH"' \
  "GBM_BACKENDS_PATH and LIBGL_DRIVERS_PATH are not let through"
check "NixOS's driver directory is let through" \
  '"/run/opengl-driver/lib/"' \
  "/run/opengl-driver/lib is not let through"
check "the render nodes and sysfs entries are let through" \
  'AddDrmGpuPermissions(permissions);' \
  "the render nodes and /sys/dev/char stay refused"
check "the desktop sandbox brokers readlink" \
  'if (!IsChromeOS()) {' \
  "readlink stays off on the desktop, so libdrm cannot read sysfs"

[ "$FAILED" -eq 0 ] || exit 1
