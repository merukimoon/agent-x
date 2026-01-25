# Agent Failure Protocol

## 1) Purpose
- Define how agents record failures in a deterministic way.
- Align failure handling with lifecycle, artifacts, and verification.

## 2) Definitions
- **Failure**: Agent cannot complete its step or must halt due to a blocking condition.
- **Error Category**: Hard constraint violation, soft rule violation, operational error, or domain error.
- **Hard vs Soft**: Hard constraints must fail validation; soft rules may be violated with annotation.
- **Terminal State**: Run-level status (`done` or `failed`) recorded in `run.json`.

## 3) Failure Protocol (Canonical)
- Required writes when a step fails:
  - `outputs/<agent>/result.json` with `status` indicating failure and an error description.
  - `outputs/<agent>/notes.md` describing cause and next action (if any).
- Optional writes:
  - `outputs/<agent>/status.json` if the flow emits status metadata.
- Required structure (textual, not schema):
  - `result.json` includes: `run_id`, `step_id`, `status` (failed/blocked), timestamps, and error message; agent-specific payload may remain partial.
  - `notes.md` states category and context.
- Forbidden: Silent failure, missing required files, overwriting other agents’ artifacts.

## 4) Error Categories
- Hard constraint violation: breaks required artifacts, lifecycle, or rules_model hard constraints. Record in `result.json` error field; verification must fail.
- Soft rule violation: allowed with annotation. Record rule ID and rationale in `notes.md`; verification may warn in future.
- Operational error (tooling/environment): record error message and impact in `result.json` and `notes.md`; run may fail if step cannot proceed.
- Domain error (goal cannot be satisfied): record rationale and unmet conditions; run outcome determined by coordinator/decision-maker.

## 5) Interaction with Run Lifecycle
- A failing step sets `status` in its `result.json`; the run reaches a terminal state only when `run.json` is updated to `done` or `failed`.
+- Failed steps do not mark the run finished by themselves; final status is set by the flow/controller.

## 6) Interaction with Run Artifacts
- Even on failure, required files for executed steps must exist: `outputs/<agent>/result.json` and `notes.md`.
- `status.json` remains optional.
- `run.json`, `plan.json`, and `summary/final.md` remain required for finished runs per lifecycle rules.

## 7) Soft Rule Violations vs Failures
- Soft rule violation alone does not change run status; annotate in `notes.md` with rule ID and rationale.
- Hard constraint violation or unrecoverable operational/domain error drives the run toward `status=failed`.

## 8) Golden Path Alignment
- Golden Path v0 does not contain failing steps; this protocol aligns with current artifacts and adds explicit guidance for future failures without adding new files.

## 9) Non-Goals
- No new schema fields beyond existing artifacts.
- No automation for retries or overrides.
- No policy for external escalation or human approval paths.
