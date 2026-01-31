# Release Hygiene & Trust Pack

## Purpose
- Define how stability and trust are established for AgenticX.
- Describe what is guaranteed, what is not, and how releases are produced safely.

## Stability and Guarantees
- Stable: documented contracts (`docs/contracts/*`), run artifacts layout, run lifecycle states, finished criteria, and enforced hard constraints (R1, R2, R3, R4, R5, R8) as implemented today.
- Stable: canonical ADX entry commands (`pnpm exec agentic verify-run --run <RUN>`), with maintained Make convenience targets (`make verify`, `make verify-plan-e2e`, `make verify-flow`, `make orchestrator-validate`, `make validate-run RUN=<RUN>`), and status semantics in `docs/status.md`.
- Stable: required artifacts per agent (`outputs/<agent>/result.json`, `outputs/<agent>/notes.md`, step decision files) and run-level files (`run.json`, `summary/final.md`, `plan.json`, `steps/index.json` when steps exist).
- Non-guaranteed: undocumented commands, experimental scripts, ad hoc folder layouts outside `runs/`, and any behavior not covered by the contracts or verification commands.
- Trust is derived from artifacts on disk plus verification outcomes; no out-of-band assurances exist.

## Compatibility and Breaking Changes
- A change is breaking if it alters required artifacts, lifecycle states, finished criteria, status output fields, enforced hard constraints, CLI/make command interfaces, or run directory layout in a way that invalidates existing runs.
- Allowed without breaking compatibility: additive optional fields, new soft rules (with required annotations), new examples, documentation clarifications, and new agents that follow existing contracts.
- Any change to hard constraints, required artifacts, or command semantics must be called out as Breaking and paired with a version bump.
- Breaking changes are communicated via the `Breaking` section in `CHANGELOG.md` and the release tag.

## Versioning Policy
- Uses SemVer-style versions from `package.json`.
- Pre-1.0: minor (`0.X.0`) may include breaking changes; patch (`0.X.Y`) must remain compatible with the current contracts and enforced hard constraints.
- Contract or verifier changes that harden checks require a version bump (minor pre-1.0; major after 1.0).
- Soft-rule documentation changes without enforcement do not require a version bump but must still be recorded if user-visible.

## Changelog Discipline
- `CHANGELOG.md` in the repo root is canonical.
- Every release (and unreleased work) must include the sections: Added, Changed, Fixed, Breaking. Use “None” when a section has no items.
- Record user-visible changes: contract updates, verification/enforcement changes, CLI/make interface changes, artifact layout changes, and docs that alter behavior expectations.
- Do not log internal refactors that do not affect behavior or guarantees.

## Release Process and Checklist
- Update documentation to match behavior (contracts, status, quickstart, extensibility).
- Bump version in `package.json` according to the versioning policy.
- Update `CHANGELOG.md` with entries under Added/Changed/Fixed/Breaking.
- Run required verification in this order and stop on failure:
  - `pnpm run typecheck`
  - `pnpm run verify:esm`
  - `TMPDIR=/tmp pnpm run test`
  - `make verify-flow`
  - `validate-run` (or `make validate-run RUN=<RUN_ID>` for the produced run)
  - `make orchestrator-validate`
  - `validate-run` (rerun on the orchestrated run)
  - `make orchestrator-validate` (planner-architect mode or as configured)
  - `validate-run` (final check)
- Tag the release (`vX.Y.Z`) only after all commands pass and the changelog is updated.
- A release is invalid if any required command fails, if required artifacts are missing, or if the changelog/version bump is incomplete.

## Verification Commands (Canonical)
- Quick check: `make verify-fast`
- Full check: `make verify`
- Flow check: `make verify-flow`
- Run validation: `make validate-run RUN=<RUN_ID>` (alias: `make verify-run RUN=<RUN_ID>`, `pnpm exec agentic verify-run --run <RUN_ID>`)
- Orchestrator validation: `make orchestrator-validate GOAL="..." [MODE=planner|planner-architect]`
- Planner-driven end-to-end: `make verify-plan-e2e GOAL="..." CONTEXT="..."`

## Non-Goals
- No roadmap or future guarantees.
- No policy for unpublished artifacts or non-canonical scripts.
- No relaxation of contracts or enforcement; this pack documents current behavior only.
