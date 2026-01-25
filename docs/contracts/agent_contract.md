# Agent Contract

## 1) Purpose
- Define a testable contract for agent inputs, outputs, and boundaries.
- Align agent responsibilities with run lifecycle and artifacts.

## 2) Definitions
- **Agent**: A role-bound executor invoked as a step in a run.
- **Step**: One agent invocation recorded in `steps/` and `outputs/<agent>/`.
- **Input**: Data an agent may read (inputs, plan, prior outputs).
- **Output**: Files an agent must write under its `outputs/<agent>/` folder.
- **Artifact**: Any file produced under `runs/<RUN>/`.
- **Forbidden**: Actions or omissions that violate this contract.

## 3) Contract Overview
- Agent responsibilities: read allowed inputs, produce required outputs, report status, and avoid side effects outside its folder.
- System responsibilities: scaffold run layout, route inputs, enforce policies, and verify artifacts.

## 4) Inputs (Allowed Sources)
- Run inputs: `inputs/request.md`, `inputs/context.md`.
- Plan: `plan.json`.
- Prior step artifacts: `steps/` entries and `outputs/<agent>/` from earlier steps.
- Repo files: read-only access to working tree if needed for context (no writes).
- Disallowed: any input not present in the run folder or repository; network calls or hidden state are out of scope.

## 5) Outputs (Required)
- Each executed step must produce under `outputs/<agent>/`:
  - `result.json` with agent status fields (as observed today).
  - `notes.md` summarizing reasoning or context usage.
  - `status.json` when emitted by the flow (optional per current behavior).
- Naming rules:
  - Folder name matches agent id (e.g., `outputs/planner/`, `outputs/coordinator/`).
  - File names use lowercase with `.json` or `.md` extensions as observed.
- Required fields in `result.json` (observed today): `status`, `started_at`, `finished_at`, `run_id`, `step_id`, plus agent-specific payload.

## 6) Outputs (Optional)
- `status.json` when provided by the agent flow.
- Additional attachments placed under `artifacts/` and referenced from `result.json` or `notes.md`.
- Inline metadata inside `result.json` beyond the required fields.

## 7) Forbidden Behaviors
- No writing outside `outputs/<agent>/`, `artifacts/`, or explicitly assigned paths.
- No skipping required files (`result.json`, `notes.md`) when a step runs.
- No altering other agents’ outputs or steps.
- No inventing run state (e.g., falsifying `run.json`, `plan.json`, or step lists).
- No reliance on undefined inputs or external services for contract satisfaction.

## 8) Failure Handling
- On failure, agent still writes `outputs/<agent>/result.json` with `status` indicating failure and an error description.
- `notes.md` should explain failure context.
- Partial outputs remain but do not mark the run finished; terminal state is determined by the system via `run.json`.

## 9) Relationship to Run Lifecycle and Verification
- Required outputs map to the run artifacts contract: missing `result.json` or `notes.md` causes validation failure for finished runs.
- Lifecycle terminal states (`done`, `failed`) depend on agent outputs plus `run.json` fields and `summary/final.md`.
- Verification (`make validate-run`, `make verify-run`) can check presence and shape of required agent outputs; `make verify-flow` and `make orchestrator-validate` produce runs that satisfy this contract in Golden Path scenarios.

## 10) Golden Path Alignment
- Golden Path v0 runs include planner, coordinator, decision-maker, and PR reviewer outputs with `result.json`, `notes.md`, and optional `status.json` under their `outputs/` folders; this matches the required and optional outputs defined here.

## 11) Non-Goals
- Does not define agent reasoning methods or model selection.
- Does not mandate new schemas beyond observed `result.json` shape.
- Does not cover external integrations or future agent types not present today.

## Failure Protocol
- See `docs/contracts/agent_failure_protocol.md` for the canonical failure rules and required artifacts on failure.
