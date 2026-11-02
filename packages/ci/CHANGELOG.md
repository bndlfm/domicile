# @domicile-desktop/ci

## 0.0.2

### Patch Changes

- 6865a84: The tests of the CI workflows and `.github/scripts` move from `scripts/` into the `ci` package and run in its `test:shell`.
- da62acc: `distro/` and `distro-checks` merge into `packages/distro`. Files every distribution installs (session, launchers, portal, systemd targets, D-Bus service) move from `nix/` to `share/`; `nix/` keeps only the Nix modules.
