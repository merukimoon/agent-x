# Data Scientist

This document defines the Data Scientist role as implemented today.

## Purpose

The Data Scientist agent produces the Data Scientist step artifacts and output artifacts for a run.
It reviews inputs and prior outputs for measurement and modeling considerations and records guidance.
It does not execute user work or modify plan.json.

## Owns

1. The Data Scientist step artifacts for a run.
2. The Data Scientist output artifacts for a run.
3. A deterministic decision record for the Data Scientist step.

## Cannot

1. Execute repository changes.
2. Call external services.
3. Write or modify plan.json.
4. Modify run.json.
5. Change flow type or step ordering.

## Blocking Behavior

1. Blocking: Yes when the Data Scientist step exists in plan.json.
2. Missing required inputs, missing outputs, or invalid Data Scientist step artifacts cause verify-run and downstream validation to fail.

## Run Artifacts

1. Produces `runs/<RUN_ID>/outputs/data-scientist/result.json`, `runs/<RUN_ID>/outputs/data-scientist/notes.md`, and `runs/<RUN_ID>/outputs/data-scientist/status.json`.
2. Produces `runs/<RUN_ID>/steps/<STEP_ID>/step_result.json`, `runs/<RUN_ID>/steps/<STEP_ID>/decision_after_step.json`, `runs/<RUN_ID>/steps/<STEP_ID>/effective_decision.json`, and updates `runs/<RUN_ID>/steps/index.json`.
3. Reads `runs/<RUN_ID>/inputs/request.md`, `runs/<RUN_ID>/inputs/context.md`, and prior outputs listed in depends_on for the Data Scientist step in plan.json.

### Observability

1. `runs/<RUN_ID>/outputs/data-scientist/notes.md` records the excerpts of request and context used by the Data Scientist.
2. `runs/<RUN_ID>/outputs/data-scientist/status.json` and `runs/<RUN_ID>/steps/index.json` show the Data Scientist step status, model reference, and duration.
3. `runs/<RUN_ID>/steps/<STEP_ID>/` holds the step decision and result records used by verify-run and status commands.

## Inputs

The Data Scientist agent reads exactly these required inputs.

1. `runs/<RUN_ID>/inputs/request.md`
2. `runs/<RUN_ID>/inputs/context.md`
3. Prior outputs listed in the plan step depends_on chain.

If any required input file or prior output referenced by the step is missing, Data Scientist does not run.

## Outputs

The Data Scientist agent writes the canonical outputs directory for the Data Scientist agent.

1. `runs/<RUN_ID>/outputs/data-scientist/result.json`
2. `runs/<RUN_ID>/outputs/data-scientist/notes.md`
3. `runs/<RUN_ID>/outputs/data-scientist/status.json`

The Data Scientist agent also writes the canonical step artifact set for its step id.

1. `runs/<RUN_ID>/steps/<STEP_ID>/step_result.json`
2. `runs/<RUN_ID>/steps/<STEP_ID>/decision_after_step.json`
3. `runs/<RUN_ID>/steps/<STEP_ID>/effective_decision.json`
4. `runs/<RUN_ID>/steps/index.json`

## Invariants

1. Outputs paths in plan.json for the Data Scientist step match the canonical Data Scientist outputs folder.
2. Data Scientist does not change step statuses other than writing its own step artifacts.

## Failure Modes

1. Missing run directory, inputs, or required prior outputs causes an immediate CLI error and no Data Scientist artifacts are created.
2. File system write failures can leave incomplete artifacts and cause validation to fail for the run.

## Verification Expectations

1. verify flow writes Data Scientist outputs according to the plan and finishes with a valid run artifact set when the Data Scientist step exists.
2. validate run reports success when Data Scientist output artifacts and Data Scientist step artifacts exist and parse as valid JSON where applicable.
3. Status commands are read only and must not change run.json.

## Definition of Done

1. `runs/<RUN_ID>/outputs/data-scientist/result.json`, `notes.md`, and `status.json` exist and parse as valid JSON where applicable.
2. `runs/<RUN_ID>/steps/<STEP_ID>/` contains step_result.json, decision_after_step.json, effective_decision.json, and steps/index.json records the Data Scientist step with a non pending status consistent with the artifacts.
3. verify-run or validate-run on the run completes without errors attributable to the Data Scientist step.

