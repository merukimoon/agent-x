# Step lifecycle map

## Current state
* Steps are defined in `packages/core/src/model/plan.ts` as `PlanStep` and stored in `runs/<run_id>/plan.json` with status, attempt, max_attempts, last_error, allow_skip.
* `plan.steps[]` is a DAG with unique `id`, `agent`, `status`, and `depends_on` referencing step ids only (never agent names). Planner and coordinator are explicit steps; CISO is included and may be skipped.
* `packages/cli/src/cli.ts` function `runFlow` drives plan execution: validate via `runValidationChecks`, enforce dependency validation, loop pending steps, call `ensureDependencies`, mark `running` then `done` or `failed` using `applyStatusTransition`, persisting plan.json.
* `packages/cli/src/agents.ts` function `runAgent` sets up `outputs/<agent>/`, writes `result.json`, `notes.md`, and `status.json` containing agent, run, status, mode, created_at_utc (and finished_at_utc when applicable); coordinator also writes `plan.json`.
* Orchestrator summary generation reads the planner human summary from `planner_summary.md` when present, and falls back to `outputs/planner/notes.md` only for display and handoff. Validation still requires the canonical artifacts `outputs/planner/result.json`, `outputs/planner/notes.md`, and `outputs/planner/status.json`.
* Per step canonical artifacts are persisted under `runs/<run_id>/steps/<step_id>/`: `step_result.json` (StepResult v1) and `decision_after_step.json` (DecisionAfterStep v1). A lightweight index lives at `runs/<run_id>/steps/index.json` (schema steps-index.v1) for status.
* Gating policy (gating-policy.v1) resolves strictness (soft or hard) via precedence: step > agent > pipeline > system_default. Soft checks failing under hard strictness trigger a human gate; hard check failures halt; missing inputs trigger request_clarification.
* Human gates write `human_prompt.md` under the step directory when decision action is `require_human` or `request_clarification`.
* Overrides are explicit artifacts at `runs/<run_id>/steps/<step_id>/override.json`. Overrides are only applied when the base decision requires human input or clarification and never downgrade a hard failure to continue; the applied decision is persisted as `effective_decision.json`.

## Outputs and status
* Run folders hold inputs, outputs per agent, summary/final.md, and run.json. `run.json` is the state source of truth and records started/finished timestamps, flow, status, exit_code, and error.
* Status command `handleStatusCommand` reads `plan.json` when present to render step rows; it does not mutate plan or run state.

### Skipped steps (policy-bound)

* `status: skipped` is terminal but only valid when policy allows the agent to skip (currently the CISO step in dry-run verification flows).
* Skipped steps must still write the canonical artifacts: `outputs/<agent>/{result.json,notes.md,status.json}` and `steps/<step_id>/{step_result.json,decision_after_step.json,effective_decision.json,steps/index.json}`.
* `status.json` and `step_result.json` must include a `reason` object with `code` (`dry_run` | `not_applicable` | `precondition_unmet` | `policy_disabled`), `message`, and `at_utc`. Missing reasons invalidate the run.
