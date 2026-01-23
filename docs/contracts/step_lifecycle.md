# Step lifecycle map

## Current state
* Steps are defined in `scripts/agentic/core.ts` as `PlanStep` and stored in `runs/<run_id>/plan.json` with status, attempt, max_attempts, last_error, allow_skip.
* `plan.steps[]` is a DAG with unique `id`, `agent`, `status`, and `depends_on` referencing step ids only (never agent names). Planner and coordinator are explicit steps; CISO is included and may be skipped.
* `packages/cli/src/cli.ts` function `runFlow` drives plan execution: validate via `runValidationChecks`, enforce dependency validation, loop pending steps, call `ensureDependencies`, mark `running` then `done` or `failed` using `applyStatusTransition`, persisting plan.json.
* `packages/cli/src/agents.ts` function `runAgent` sets up `outputs/<agent>/`, writes `result.json`, `notes.md`, and `status.json` containing agent, run, status, mode, created_at_utc (and finished_at_utc when applicable); coordinator also writes `plan.json`.
* Orchestrator summary generation reads the planner human summary from `planner_summary.md` when present, and falls back to `outputs/planner/notes.md` only for display and handoff. Validation still requires the canonical artifacts `outputs/planner/result.json`, `outputs/planner/notes.md`, and `outputs/planner/status.json`.

## Outputs and status
* Run folders hold inputs, outputs per agent, summary/final.md, and run.json. `run.json` is the state source of truth and records started/finished timestamps, flow, status, exit_code, and error.
* Status command `handleStatusCommand` reads `plan.json` when present to render step rows; it does not mutate plan or run state.
