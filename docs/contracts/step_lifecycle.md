# Step lifecycle map

## Current state
* Steps are defined in `scripts/agentic/core.ts` as `PlanStep` and stored in `runs/<run_id>/plan.json` with status, attempt, max_attempts, last_error, allow_skip.
* `packages/cli/src/cli.ts` function `runFlow` drives plan execution: validate via `runValidationChecks`, loop pending steps, call `ensureDependencies`, mark `running` then `done` or `failed` using `applyStatusTransition`, persisting plan.json.
* `packages/cli/src/agents.ts` function `runAgent` sets up `outputs/<agent>/`, writes `result.json` containing agent, run, status, mode, created_at_utc, summary, writes `notes.md` with request and context excerpts via `buildNotes`, and coordinator also writes `plan.json`.

## Outputs and status
* Run folders hold inputs, outputs per agent, optional summary and run.json; artifacts folder is present but not used by execution logic.
* Status command `handleStatusCommand` reads `plan.json` when present to render step rows; fallback inspects `outputs/<agent>/result.json` for status and timestamps. It does not read any other per step artifact.

## Planned integration points
* Create the canonical step result before agent invocation inside `runFlow` and allow `runAgent` to populate outputs plus validation and signal data.
* Persist step level data under `runs/<run_id>/steps/<step_id>/` using `writeFileAtomic` from `scripts/agentic/fs.ts`, and add an index file for status reads.
* Emit the decision after each step once validation completes inside the `runFlow` loop, driven by deterministic checks instead of model choice.
* Extend `handleStatusCommand` to read the new index and per step files to show status, decision action, model used, and duration while keeping existing behavior for legacy runs.
