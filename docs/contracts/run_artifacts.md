# Run Artifacts Contract

## 1) Purpose
- Define the mandatory artifacts for runs in AgenticX.
- Make validity and completion checks deterministic.

## 2) Definitions
- **Run**: A scoped execution with a stable `run_id`, inputs, outputs, and recorded status.
- **Step**: An individual agent execution tracked in `steps/` and `outputs/<agent>/`.
- **Artifact**: Any file under `runs/<RUN>/` produced during the run.
- **Required vs Optional**: Required artifacts must exist for a run to meet the stated condition; optional artifacts may be absent without failing validation.

## 3) Observed Run Layout
- Root files: `run.json`, `plan.json`, `README.md` (optional).
- Inputs: `inputs/request.md`, `inputs/context.md`.
- Outputs: `outputs/<agent>/` folders with `result.json`, `notes.md`, `status.json` when produced.
- Steps: `steps/index.json` plus `steps/<step-id>/` folders with `decision_after_step.json`, `effective_decision.json`, `step_result.json`.
- Summary: `summary/final.md`.
- Artifacts: `artifacts/` (may contain `.gitkeep` only).

## 4) Artifact Sets
### 4.1 Minimal “Run exists”
- `run.json` with `run_id` (or `id`) and `status`.
- `inputs/request.md`
- `inputs/context.md`

### 4.2 “Valid run” requirements
- All “Run exists” artifacts.
- `plan.json` present.
- `steps/index.json` present if any steps were executed or planned.
- For each agent that ran: `outputs/<agent>/result.json` and `outputs/<agent>/notes.md`.
- `summary/final.md` present if any step completed.

### 4.3 “Finished run” requirements (success)
- All “Valid run” artifacts.
- `run.json.status=done` and `exit_code=0`.
- `summary/final.md` present.
- `steps/index.json` lists all executed steps with terminal statuses.

### 4.4 “Finished run” requirements (failure)
- All “Run exists” artifacts.
- `run.json.status=failed` and `exit_code>0` with `error` populated.
- If partial outputs exist, they remain under `outputs/` and `steps/` as written before failure (optional for failure classification).

## 5) Step Artifact Rules
- `steps/index.json` enumerates steps and statuses; required when any step runs.
- Each step folder (`steps/<step-id>/`) should include `decision_after_step.json`, `effective_decision.json`, and `step_result.json` for executed steps.
- Missing per-step files indicate an incomplete step and should cause validation failure for “finished” states.

## 6) Optional Artifacts
- `README.md` inside the run.
- `artifacts/` contents (except `.gitkeep` placeholder).
- `outputs/<agent>/status.json` when not emitted by the flow.
- Additional notes or attachments not referenced by plan/summary.

## 7) Relationship to Verification
- `make validate-run` / `make verify-run` fail when required artifacts for a “valid run” or “finished run” are missing or inconsistent.
- `make verify-flow` produces a run that satisfies the “finished run (success)” set.
- `make orchestrator-validate` produces a run that satisfies the “finished run (success)” set for planner + architect flows and asserts `run.json` immutability when reading status.
- Missing required artifacts → treat as invalid run (fail verification). Partial step artifacts without terminal status → treat as incomplete (fail finished-run checks).
- Finished criteria reference: see `docs/contracts/run_lifecycle.md` (Run Finished Criteria) for the authoritative terminal state checklist.

## 8) Golden Path Alignment
- Golden Path v0 uses `make verify-flow` followed by `make validate-run`; the produced run meets the “finished run (success)” requirements: inputs, plan.json, steps index, per-agent outputs, summary, and `run.json` with `status=done`.

## 9) Non-Goals
- No future-state predictions or multi-run aggregation rules.
- No prescription for external storage or artifact promotion.
- Does not redefine agent contract payloads (see agent-contract for payload schema).
