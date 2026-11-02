# @domicile-desktop/distro

## 0.0.2

### Patch Changes

- 13107cb: The tests of the distribution packages and the flake move from `scripts/` into the `distro` package, as `test:shell`, `test:nix` and `test:distro`.
- da62acc: `distro/` and `distro-checks` merge into `packages/distro`. Files every distribution installs (session, launchers, portal, systemd targets, D-Bus service) move from `nix/` to `share/`; `nix/` keeps only the Nix modules.
