# Agent Extensibility Guide

## 1) Purpose
- Explain how to add a new agent without breaking contracts or verification.
- Provide a checklist that is enforceable today.

## 2) What an Agent Is (and Is Not)
- An agent is a governed step that reads declared inputs and writes required run artifacts.
- Agents do not pick their own lifecycle; they follow the run lifecycle contract.
- Agents may not invent state, mutate other agents’ artifacts, or skip required files.
- Constraints exist to keep runs auditable and verification deterministic.

## 3) Preconditions
- Read and follow: `docs/contracts/agent_contract.md`, `docs/contracts/agent_failure_protocol.md`, `docs/contracts/run_artifacts.md`, `docs/contracts/run_lifecycle.md`, `docs/contracts/rules_model.md`, `docs/contracts/verification_contract.md`, `docs/status.md`, and `docs/golden-path-v0.md`.
- Use a unique agent name (lowercase, hyphen/underscore allowed) that appears in `plan.json` and `steps/index.json`.
- Place code/config where the flow expects it; do not relocate run directories or artifact names.

## 4) How to Add an Agent (Step-by-Step)
- Define the role: decide what the agent is responsible for and what inputs it needs.
- Declare the step in `plan.json`: set `id`, `agent`, `depends_on`, `inputs`, `outputs`, `status`, `attempt`, `max_attempts`.
- Ensure `steps/index.json` will list the step (planner or orchestrator populates it).
- Implement the agent to read only allowed inputs: `inputs/request.md`, `inputs/context.md`, prior step outputs referenced in the plan, and step-level inputs.
- Write outputs only under `outputs/<agent>/` and `steps/<step-id>/` as described below.
- Keep `run.json` and `summary/final.md` untouched; the orchestrator writes them.

## 5) Required Artifacts (Checklist)
- `outputs/<agent>/result.json` with status, run_id, step_id, and payload required by the agent contract.
- `outputs/<agent>/notes.md` with reasoning and any soft-rule annotations (rule ID + rationale).
- `steps/<step-id>/decision_after_step.json`
- `steps/<step-id>/effective_decision.json`
- `steps/<step-id>/step_result.json`
- `steps/index.json` entry for the step with status and agent name.
- Optional: `outputs/<agent>/status.json` if the flow already writes it; not required.

## 6) Verification and Enforcement
- `make verify` and `make verify-plan-e2e` run `verify-run` checks that fail when required artifacts are missing or inconsistent with `run.json` or the lifecycle.
- Hard constraints enforced now include: `inputs/request.md`, `inputs/context.md`, `summary/final.md` for finished runs, `plan.json` and `steps/index.json` when steps exist, per-step decision files, and per-step `result.json`/`notes.md`.
- Soft rules must be annotated in `outputs/<agent>/notes.md`; they do not fail runs unless promoted to hard constraints.
- Any mismatch between `run.json` terminal status/exit_code and artifacts causes verification failure.

## 7) Observability and Debugging
- Status is derived from run artifacts only; use `node --import tsx scripts/agentic.ts status --run <RUN_ID>` to view it.
- `docs/status.md` explains the fields: Overall (lifecycle), Artifacts (valid/invalid), Blocking (blocked/unblocked), per-step rows.
- Inspect `outputs/<agent>/result.json` and `outputs/<agent>/notes.md` to confirm the agent behavior.
- Verification errors list missing or invalid artifacts; fix artifacts, not the verifier.

## 8) Common Mistakes and Anti-Patterns
- Missing any required file in the checklist above.
- Writing outputs outside `outputs/<agent>/` or overwriting another agent’s files.
- Marking success in `run.json` without producing required artifacts.
- Skipping `steps/index.json` updates when steps exist.
- Treating soft rules as ignorable without adding annotations.
- Inventing new artifact names without updating contracts (not supported).

## 9) Minimal Example (Conceptual)
- Add agent `security-reviewer` to an existing plan.
- Plan step: `id: "security-review"`, `agent: "security-reviewer"`, depends_on: planner step, outputs: `outputs/security-reviewer/result.json` and `notes.md`.
- Execution: agent reads `inputs/request.md`, `inputs/context.md`, planner outputs as referenced, writes `result.json` with `status: "done"` and findings, writes `notes.md` with rationale and any soft-rule annotations, writes step decision files under `steps/security-review/`.
- Verification: `make verify` fails if any file above is missing or if `run.json` exit_code/status is inconsistent with produced artifacts.

## 10) Non-Goals
- No guidance on prompt/model choice.
- No changes to scheduling or orchestration policies.
- No roadmap or speculative features. The guide reflects current behavior only.
