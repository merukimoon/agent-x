# ADR-003: Package Manager, Contracts Package, and Make Scope

Date: 2026-01-25
Status: Accepted

## Context
- The repository previously relied on npm with a package-lock and lacked a pinned package manager version.
- Make targets are widely used by contributors but should not be part of the public/release surface.
- Contract types lived under `packages/core/src/contracts`, and the monorepo lacked a canonical contracts package to anchor future workspace tooling (e.g., Nx).

## Decision
1) **Package manager**: Adopt pnpm (pinned via `packageManager: pnpm@9.12.3`). Remove `package-lock.json`, generate `pnpm-lock.yaml`, and use Corepack-driven installs (`pnpm install --frozen-lockfile`) with pnpm store caching in CI.
2) **Make scope**: Treat Makefiles as contributor convenience only. The supported/public entry points are the CLI scripts (`pnpm run dev ...` and `pnpm run verify-run ...`). Make targets remain for internal verification but are not release guarantees.
3) **Contracts package**: Establish `packages/contracts` as the canonical home for enforceable contracts (currently the step/run contract types) and import from there across the codebase.
4) **Nx readiness**: Keep the workspace package-based and pnpm-managed (`pnpm-workspace.yaml` with `packages/*`), without introducing Nx yet; the structure is prepared for future Nx adoption.

## Consequences
### Positive
- Deterministic installs with pnpm and cacheable pnpm store in CI/local flows; package manager drift is prevented by the pinned version.
- Clear separation between public CLI commands and contributor-only Make targets reduces accidental surface commitments.
- Contracts are discoverable under `packages/contracts`, easing future package-based tooling (including Nx) without further relocations.
### Trade-offs
- Contributors must use pnpm (via Corepack) and regenerate `pnpm-lock.yaml`; npm workflows are no longer maintained.
- Dual paths (CLI + Make) must stay aligned for internal verification even though only the CLI is contractual.
