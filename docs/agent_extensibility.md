# Agent Extensibility Guide

## 1) Purpose
- Explain how to add a new agent without breaking verification.

## 2) What Counts as a New Agent
- New role added to a plan or flow.
- New `outputs/<agent>/` folder with contract-compliant artifacts.
- Agent name used in `plan.json` steps and `steps/index.json`.

## 3) Required Contracts (Links)
- Agent contract: `docs/contracts/agent_contract.md`
- Failure protocol: `docs/contracts/agent_failure_protocol.md`
- Run artifacts: `docs/contracts/run_artifacts.md`
- Run lifecycle: `docs/contracts/run_lifecycle.md`
- Rules model: `docs/contracts/rules_model.md`
- Verification: `docs/contracts/verification_contract.md`
- Golden Path reference: `docs/golden-path-v0.md`

## 4) Minimal Steps to Add an Agent
- Declare agent name and role in the flow/plan definition.
- Add a step in `plan.json` with `id`, `agent`, `depends_on`, inputs, outputs, status, attempt, max_attempts.
- Ensure `steps/index.json` will list the step after execution.
- Implement agent logic to read `inputs/request.md`, `inputs/context.md`, plan inputs, and prior outputs as allowed.
- Write required outputs under `outputs/<agent>/` (see checklist below).
- Update any orchestration flow rules to include the agent if needed.

## 5) Required Artifacts (Checklist)
- `outputs/<agent>/result.json` with status, timestamps, run_id, step_id, and payload.
- `outputs/<agent>/notes.md` with reasoning/context.
- `steps/<step-id>/decision_after_step.json`
- `steps/<step-id>/effective_decision.json`
- `steps/<step-id>/step_result.json`
- `steps/index.json` updated to include the step and status.
- Optional: `outputs/<agent>/status.json` if your flow emits it.

## 6) Failure Handling Requirements
- On failure, still write `outputs/<agent>/result.json` with status=failed (or blocked) and error text.
- Record failure context in `outputs/<agent>/notes.md`.
- Do not delete or overwrite other agents’ artifacts.
- Follow the failure protocol: `docs/contracts/agent_failure_protocol.md`.

## 7) Verification Expectations
- Hard constraints enforced by verify/validate-run:
  - Inputs exist: `inputs/request.md`, `inputs/context.md`.
  - Finished runs include `plan.json`, `summary/final.md`, `steps/index.json` (if steps exist), and per-step outputs/decision files.
  - `run.json` has terminal status/exit_code consistent with lifecycle.
  - Required agent artifacts (`result.json`, `notes.md`, step decision files) exist.
- Soft rule annotations belong in `outputs/<agent>/notes.md` with rule ID and rationale.

## 8) Common Verification Failures
- Missing `outputs/<agent>/result.json` or `notes.md`.
- Missing `steps/<step-id>/decision_after_step.json` / `effective_decision.json` / `step_result.json`.
- `run.json` status/exit_code inconsistent with artifacts.
- `summary/final.md` missing for finished runs.
- Missing `inputs/request.md` or `inputs/context.md`.

## 9) Non-Goals
- No guidance on model selection or prompt design.
- No orchestration scheduling policy changes.
- No instructions for CI wiring beyond existing make targets.
