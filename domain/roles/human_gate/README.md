# Human Gate

This document defines the Human Gate role as implemented today.

## Purpose

The Human Gate step pauses execution until a human override is provided and records gate artifacts.
It does not perform automated work or modify plan.json.

## Owns

1. The Human Gate step artifacts for a run.
2. The Human Gate output artifacts for a run.
3. A deterministic decision record for the Human Gate step.

## Cannot

1. Execute repository changes.
2. Call external services.
3. Write or modify plan.json.
4. Modify run.json.
5. Change flow type or step ordering.

## Blocking Behavior

1. Blocking: Yes when the Human Gate step exists in plan.json.
2. Missing override.json when required or missing required artifacts keeps the run gated and fails verification until resolved.

## Inputs

The Human Gate agent reads exactly these required inputs.

1. `runs/<RUN_ID>/inputs/request.md`
2. `runs/<RUN_ID>/inputs/context.md`
3. Prior outputs listed in the plan step depends_on chain when present.

If any required input file or prior output referenced by the step is missing, Human Gate does not run.

## Outputs

The Human Gate agent writes the canonical outputs directory for the Human Gate agent.

1. `runs/<RUN_ID>/outputs/human_gate/result.json`
2. `runs/<RUN_ID>/outputs/human_gate/notes.md`
3. `runs/<RUN_ID>/outputs/human_gate/status.json`
4. `runs/<RUN_ID>/outputs/human_gate/override.json` (when provided by the operator)

The Human Gate agent also writes the canonical step artifact set for its step id.

1. `runs/<RUN_ID>/steps/<STEP_ID>/step_result.json`
2. `runs/<RUN_ID>/steps/<STEP_ID>/decision_after_step.json`
3. `runs/<RUN_ID>/steps/<STEP_ID>/effective_decision.json`
4. `runs/<RUN_ID>/steps/index.json`

## Invariants

1. Outputs paths in plan.json for the Human Gate step match the canonical Human Gate outputs folder.
2. Human Gate does not change step statuses other than writing its own step artifacts.

## Run Artifacts

1. Produces `runs/<RUN_ID>/outputs/human_gate/result.json`, `runs/<RUN_ID>/outputs/human_gate/notes.md`, and `runs/<RUN_ID>/outputs/human_gate/status.json`; when supplied, consumes `outputs/human_gate/override.json`.
2. Produces `runs/<RUN_ID>/steps/<STEP_ID>/step_result.json`, `runs/<RUN_ID>/steps/<STEP_ID>/decision_after_step.json`, `runs/<RUN_ID>/steps/<STEP_ID>/effective_decision.json`, and updates `runs/<RUN_ID>/steps/index.json`.
3. Reads `runs/<RUN_ID>/inputs/request.md`, `runs/<RUN_ID>/inputs/context.md`, and prior outputs listed in depends_on for the Human Gate step in plan.json.

### Observability

1. `runs/<RUN_ID>/outputs/human_gate/notes.md` records the human prompt and instructions to proceed.
2. `runs/<RUN_ID>/outputs/human_gate/status.json` and `runs/<RUN_ID>/steps/index.json` show the Human Gate step status and duration.
3. `runs/<RUN_ID>/outputs/human_gate/override.json` captures operator decisions that allow resuming the run.

## Failure Modes

1. Missing run directory, inputs, or required prior outputs causes an immediate CLI error and no Human Gate artifacts are created.
2. Missing override.json when the step is gated keeps the run blocked and causes validation to fail until resolved.
3. File system write failures can leave incomplete artifacts and cause validation to fail for the run.

## Verification Expectations

1. verify flow or orchestrator-gated flows write Human Gate outputs or gate artifacts according to the plan and finish with a valid run artifact set when the Human Gate step exists.
2. validate run reports success when Human Gate output artifacts and Human Gate step artifacts exist, parse as valid JSON where applicable, and include override.json when required.
3. Status commands are read only and must not change run.json.

## Definition of Done

1. `runs/<RUN_ID>/outputs/human_gate/result.json`, `notes.md`, and `status.json` exist and parse as valid JSON where applicable; override.json exists when the step is gated.
2. `runs/<RUN_ID>/steps/<STEP_ID>/` contains step_result.json, decision_after_step.json, effective_decision.json, and steps/index.json records the Human Gate step with a non pending status consistent with the artifacts.
3. verify-run or validate-run on the run completes without errors attributable to the Human Gate step.
