# @domicile-desktop/check-runner

## 0.0.2

### Patch Changes

- 4432cb1: Adds `check-runner`, which runs a package's shell checks under turbo's `test:shell`; the skip scan moves to it from `e2e-harness`.
- 13107cb: The tests of the distribution packages and the flake move from `scripts/` into the `distro` package, as `test:shell`, `test:nix` and `test:distro`.
- ae139f0: `check-runner --jobs N` runs checks at once; a `# check-runner: alone` check runs by itself after the rest. The CI checks run 4 at once.
