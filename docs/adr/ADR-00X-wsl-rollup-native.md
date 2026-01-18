# ADR-00X: Pin Linux Rollup native package for WSL/Linux compatibility

Date: 2026-01-18
Status: Accepted

## Context
The project is developed on Windows and also executed in WSL (Linux). When `node_modules` is produced by a Windows install, platform-specific native dependencies may include only Windows binaries. Vitest relies on Rollup native packages, so WSL fails when the Linux Rollup native package is missing.

Observed error:
- WSL cannot resolve `@rollup/rollup-linux-x64-gnu`

## Decision
Add `@rollup/rollup-linux-x64-gnu@4.55.1` to `devDependencies` to ensure the Linux Rollup binary is available when running under WSL/Linux.

No changes are required to test code or npm scripts (they already use `vitest`).

## Consequences
### Positive
- WSL/Linux runs are stable even if the repository was previously installed on Windows.
- Avoids WSL-only workarounds and keeps scripts consistent across platforms.

### Trade-offs
- Slightly larger dependency tree (adds an explicit platform native package).
- Must keep the pinned native package version aligned with Rollup upgrades.

## Alternatives considered
1. Require developers to always reinstall dependencies per environment (Windows vs WSL).
   - Pros: No extra dependencies.
   - Cons: Easy to forget; regressions recur.
2. Use separate workspaces/lockfiles per platform.
   - Pros: Strong isolation.
   - Cons: Higher maintenance overhead.
3. Containerize the test environment.
   - Pros: Deterministic.
   - Cons: Adds runtime friction for local development.
