# Tech Lead

This document defines the Tech Lead role as implemented today.

## Purpose

The Tech Lead produces the Tech Lead step artifacts and output artifacts for a run.
It reviews inputs and prior outputs for technical feasibility and sequencing guidance.
It does not execute user work or modify plan.json.

## Owns

1. The Tech Lead step artifacts for a run.
2. The Tech Lead output artifacts for a run.
3. A deterministic decision record for the Tech Lead step.

## Cannot

1. Execute repository changes.
2. Call external services.
3. Write or modify plan.json.
4. Modify run.json.
5. Change flow type or step ordering.

## Blocking Behavior

1. Blocking: Yes when the Tech Lead step exists in plan.json.
2. Missing required inputs, missing outputs, or invalid Tech Lead step artifacts cause verify-run and downstream validation to fail.

## Run Artifacts

1. Produces `runs/<RUN_ID>/outputs/tech-lead/result.json`, `runs/<RUN_ID>/outputs/tech-lead/notes.md`, and `runs/<RUN_ID>/outputs/tech-lead/status.json`.
2. Produces `runs/<RUN_ID>/steps/<STEP_ID>/step_result.json`, `runs/<RUN_ID>/steps/<STEP_ID>/decision_after_step.json`, `runs/<RUN_ID>/steps/<STEP_ID>/effective_decision.json`, and updates `runs/<RUN_ID>/steps/index.json`.
3. Reads `runs/<RUN_ID>/inputs/request.md`, `runs/<RUN_ID>/inputs/context.md`, and prior outputs listed in depends_on for the Tech Lead step in plan.json.

### Observability

1. `runs/<RUN_ID>/outputs/tech-lead/notes.md` records the excerpts of request and context used by the Tech Lead.
2. `runs/<RUN_ID>/outputs/tech-lead/status.json` and `runs/<RUN_ID>/steps/index.json` show the Tech Lead step status, model reference, and duration.
3. `runs/<RUN_ID>/steps/<STEP_ID>/` holds the step decision and result records used by verify-run and status commands.

## Inputs

The Tech Lead reads exactly these required inputs.

1. `runs/<RUN_ID>/inputs/request.md`
2. `runs/<RUN_ID>/inputs/context.md`
3. Prior outputs listed in the plan step depends_on chain.

If any required input file or prior output referenced by the step is missing, Tech Lead does not run.

## Outputs

The Tech Lead writes the canonical outputs directory for the Tech Lead agent.

1. `runs/<RUN_ID>/outputs/tech-lead/result.json`
2. `runs/<RUN_ID>/outputs/tech-lead/notes.md`
3. `runs/<RUN_ID>/outputs/tech-lead/status.json`

The Tech Lead also writes the canonical step artifact set for its step id.

1. `runs/<RUN_ID>/steps/<STEP_ID>/step_result.json`
2. `runs/<RUN_ID>/steps/<STEP_ID>/decision_after_step.json`
3. `runs/<RUN_ID>/steps/<STEP_ID>/effective_decision.json`
4. `runs/<RUN_ID>/steps/index.json`

## Invariants

1. Outputs paths in plan.json for the Tech Lead step match the canonical Tech Lead outputs folder.
2. Tech Lead does not change step statuses other than writing its own step artifacts.

## Failure Modes

1. Missing run directory, inputs, or required prior outputs causes an immediate CLI error and no Tech Lead artifacts are created.
2. File system write failures can leave incomplete artifacts and cause validation to fail for the run.

## Verification Expectations

1. verify flow writes Tech Lead outputs according to the plan and finishes with a valid run artifact set when the Tech Lead step exists.
2. validate run reports success when Tech Lead output artifacts and Tech Lead step artifacts exist and parse as valid JSON where applicable.
3. Status commands are read only and must not change run.json.
4. New or changed code includes unit tests, and verification runs the test suite and fails on test failures.

## Definition of Done

1. `runs/<RUN_ID>/outputs/tech-lead/result.json`, `notes.md`, and `status.json` exist and parse as valid JSON where applicable.
2. `runs/<RUN_ID>/steps/<STEP_ID>/` contains step_result.json, decision_after_step.json, effective_decision.json, and steps/index.json records the Tech Lead step with a non pending status consistent with the artifacts.
3. verify-run or validate-run on the run completes without errors attributable to the Tech Lead step.
