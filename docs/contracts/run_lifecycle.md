# Run Lifecycle Contract

## 1. Purpose
- Define the canonical lifecycle for a run in AgenticX.
- Make states, required artifacts, and verification expectations testable and boring.

## 2. Definitions
- **Run**: One scoped execution attempt with a stable `run_id`, inputs, outputs, and a recorded status.
- **Step**: A single agent execution within a run, tracked in `steps/` and `outputs/<agent>/`.
- **Artifact**: Any file produced under `runs/<RUN>/` (inputs, outputs, plan, summary, attachments).
- **Verification**: Read-only commands that confirm a run’s layout, references, and contract compliance (`make validate-run`, `make verify-run`).

## 3. Run Directory Layout (observed)
- Required roots: `run.json`, `inputs/request.md`, `inputs/context.md`.
- Planning and summary: `plan.json`, `summary/final.md` (required by finished runs).
- Outputs: one folder per agent under `outputs/` with `result.json`, `notes.md`, `status.json` as produced.
- Steps index: `steps/index.json` plus per-step folders (e.g., `steps/planner/`, `steps/step-1/`).
- Artifacts: `artifacts/` for any generated files (optional; `.gitkeep` may exist).
- Readme: `README.md` may be present for quick context (optional).

## 4. Lifecycle State Machine
- States: `pending` (scaffolded), `running`, `blocked` (human gate / exit 2), `done`, `failed`.
- Transitions:
  - pending → running: Inputs exist and first agent (planner) starts.
  - running → blocked: A step emits `status: blocked` or flow exits with code 2 (human gate).
  - running → done: All planned steps finish, summary written, `run.json.status=done`, `exit_code=0`.
  - running → failed: Flow halts with non-zero exit code or missing required artifacts; `run.json.status=failed`, `exit_code>0`, `error` populated.
  - blocked → running: Operator writes an override per instructions and reruns the flow/resume command.
  - blocked → failed: Operator aborts or resume produces a non-zero exit.
- Terminal states: `done`, `failed`. `blocked` is non-terminal until resumed or aborted.

## 5. Required Artifacts
- Run is valid (any state): `run.json` with `run_id`/`status`; `inputs/request.md`; `inputs/context.md`.
- Run is finished (`done` or `failed`):
  - `run.json` with `started_at_utc`, `finished_at_utc`, `exit_code`, and `status` set to `done` or `failed`.
  - `plan.json` present and references existing inputs/outputs.
  - `outputs/<agent>/result.json` and `notes.md` for each executed step; `status.json` when emitted by the agent flow.
  - `steps/index.json` enumerating steps and statuses.
  - `summary/final.md` capturing overall outcome.

## 6. Failure and Partial Completion
- Failed run: `run.json.status=failed` and `exit_code>0`, or required artifacts missing for a finished run.
- Partial completion: Not considered finished. If a flow stops mid-way without setting `done` or `failed`, rerun or resume until a terminal state is recorded.
- Blocked runs are paused, not finished, until resolved via an override and resumed.

## 7. Relationship to Verification
- `make validate-run RUN=<RUN>` / `make verify-run RUN=<RUN>`: confirm required files exist, references resolve, and contracts/schemas match expectations. They do not mutate the run.
- `make verify-flow`: scaffolds a run, executes planner → coordinator → reviewers, then leaves artifacts suitable for `validate-run`.
- `make orchestrator-validate`: runs planner + architect orchestration, then validates the resulting run and checks `run.json` immutability when reading status.
- Verification is expected after flows complete or resume from a blocked state.

## 8. Golden Path Alignment
- Golden Path v0 (`docs/golden-path-v0.md`) uses `make verify-flow` followed by `make validate-run`, exercising the `pending → running → done` path with planner, coordinator, decision-maker, and PR reviewer outputs plus summary.

## 9. Non-Goals
- Does not define future states beyond those observed (no predictive scheduling or multi-run rollups).
- Does not cover external persistence or production pipeline behaviors.
- Does not prescribe new agents or flows beyond current commands.

## Run Finished Criteria
- Canonical finished rule:
  - `run.json` present with `status` in `{done, failed}` and `exit_code` set.
  - `started_at_utc` and `finished_at_utc` present.
  - `summary/final.md` present.
  - `plan.json` present.
  - `steps/index.json` present if any steps ran.
  - For each executed step: `outputs/<agent>/result.json` and `notes.md` exist; `status.json` when emitted.
- Success criteria:
  - `run.json.status=done`, `exit_code=0`, `error=null`, required artifacts present.
- Failure criteria:
  - `run.json.status=failed` and `exit_code>0`; `error` populated. Partial outputs may exist; absence of finished artifacts keeps the run failed, not invalid.
- Not-finished criteria:
  - Missing `finished_at_utc` or `exit_code` or `status` not in `{done, failed}`.
  - Required finished artifacts missing (plan, summary, outputs for executed steps, steps index when steps exist).
- Partial completion:
  - Partial is not a terminal state. Runs without terminal status or missing finished artifacts are treated as not finished and should be resumed or re-run.
