# QA

This document defines the QA role as implemented today.

## Purpose

The QA agent produces the QA step artifacts and output artifacts for a run.
It reviews inputs and prior outputs for quality risks and records verification guidance.
It does not execute tests or modify plan.json.

## Owns

1. The QA step artifacts for a run.
2. The QA output artifacts for a run.
3. A deterministic decision record for the QA step.

## Cannot

1. Execute repository changes.
2. Call external services.
3. Write or modify plan.json.
4. Modify run.json.
5. Change flow type or step ordering.

## Inputs

The QA agent reads exactly these required inputs.

1. `runs/<RUN_ID>/inputs/request.md`
2. `runs/<RUN_ID>/inputs/context.md`
3. Prior outputs listed in the plan step depends_on chain.

If any required input file or prior output referenced by the step is missing, QA does not run.

## Outputs

The QA agent writes the canonical outputs directory for the QA agent.

1. `runs/<RUN_ID>/outputs/qa/result.json`
2. `runs/<RUN_ID>/outputs/qa/notes.md`
3. `runs/<RUN_ID>/outputs/qa/status.json`

The QA agent also writes the canonical step artifact set for its step id.

1. `runs/<RUN_ID>/steps/<STEP_ID>/step_result.json`
2. `runs/<RUN_ID>/steps/<STEP_ID>/decision_after_step.json`
3. `runs/<RUN_ID>/steps/<STEP_ID>/effective_decision.json`
4. `runs/<RUN_ID>/steps/index.json`

## Invariants

1. Outputs paths in plan.json for the QA step match the canonical QA outputs folder.
2. QA does not change step statuses other than writing its own step artifacts.

## Failure Modes

1. Missing run directory, inputs, or required prior outputs causes an immediate CLI error and no QA artifacts are created.
2. File system write failures can leave incomplete artifacts and cause validation to fail for the run.

## Verification Expectations

1. verify flow writes QA outputs or skip artifacts according to the plan and finishes with a valid run artifact set when the QA step exists.
2. validate run reports success when QA output artifacts and QA step artifacts exist and parse as valid JSON where applicable.
3. Status commands are read only and must not change run.json.

## Observability

1. `runs/<RUN_ID>/outputs/qa/notes.md` contains the captured excerpts of request and context used for the run.
2. `runs/<RUN_ID>/steps/index.json` records the QA step status, decision action, model reference, and duration.
3. `runs/<RUN_ID>/steps/<STEP_ID>/` contains the decision and step result records for audit and gating.

