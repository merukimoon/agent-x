# Backlog

Backlog v0 (2026-01-25). Keep entries short; update next actions when state shifts.

## Open
- **PS-003 — Run lifecycle doc**
  - Outcome: Operators understand run states, artifacts, and controls.
  - Owner: Maintainers
  - Next action: Draft lifecycle doc using `runs/` layout and status commands as anchors.
  - Links: [flows](../flows.md)
- **PS-004 — Contracts baseline**
  - Outcome: Agent contracts and schemas are locked with version notes.
  - Owner: Maintainers
  - Next action: Review `../agent-contract.md` and note required version markers in `../versioning.md`.
- **PS-005 — Developer experience smoothing**
  - Outcome: Setup and day-two use are predictable for contributors.
  - Owner: Maintainers
  - Next action: List top friction points after Golden Path work; stage fixes in `../dev.md`.

## In Progress
- **PS-002 — Golden Path v0**
  - Outcome: Runnable happy path that shows planner to execution flow.
  - Owner: Maintainers
  - Next action: Capture the path in docs and align with `../run-examples/golden-path/planner-only-v1/README.md`.
  - Links: [planner-only example](../run-examples/golden-path/planner-only-v1/README.md)

## Blocked
- None.

## Done
- **PS-001 — Canonical project status baseline**
  - Outcome: Repository hosts a single source of truth for status, backlog, and decisions.
  - Owner: Maintainers
  - Next action: Refresh after each meaningful delivery or planning change.
  - Links: [status README](README.md)

## Explicitly Deferred
- **PS-006 — Productization and hosting**
  - Outcome: Decision on external offering after core flows stabilize.
  - Owner: Maintainers
  - Next action: Re-evaluate after Golden Path, lifecycle, and contracts reach done.
  - Links: [roadmap](../roadmap.md)
