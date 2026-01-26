# Decision Maker

This document defines the Decision Maker role as implemented today.

## Purpose

The Decision Maker agent produces the Decision Maker step artifacts and output artifacts for a run.
It reviews inputs and prior outputs to resolve escalated tradeoffs and records guidance.
It does not execute user work or modify plan.json.

## Owns

1. The Decision Maker step artifacts for a run.
2. The Decision Maker output artifacts for a run.
3. A deterministic decision record for the Decision Maker step.

## Cannot

1. Execute repository changes.
2. Call external services.
3. Write or modify plan.json.
4. Modify run.json.
5. Change flow type or step ordering.

## Inputs

The Decision Maker agent reads exactly these required inputs.

1. `runs/<RUN_ID>/inputs/request.md`
2. `runs/<RUN_ID>/inputs/context.md`
3. Prior outputs listed in the plan step depends_on chain.

If any required input file or prior output referenced by the step is missing, Decision Maker does not run.

## Outputs

The Decision Maker agent writes the canonical outputs directory for the Decision Maker agent.

1. `runs/<RUN_ID>/outputs/decision-maker/result.json`
2. `runs/<RUN_ID>/outputs/decision-maker/notes.md`
3. `runs/<RUN_ID>/outputs/decision-maker/status.json`

The Decision Maker agent also writes the canonical step artifact set for its step id.

1. `runs/<RUN_ID>/steps/<STEP_ID>/step_result.json`
2. `runs/<RUN_ID>/steps/<STEP_ID>/decision_after_step.json`
3. `runs/<RUN_ID>/steps/<STEP_ID>/effective_decision.json`
4. `runs/<RUN_ID>/steps/index.json`

## Invariants

1. Outputs paths in plan.json for the Decision Maker step match the canonical Decision Maker outputs folder.
2. Decision Maker does not change step statuses other than writing its own step artifacts.

## Failure Modes

1. Missing run directory, inputs, or required prior outputs causes an immediate CLI error and no Decision Maker artifacts are created.
2. File system write failures can leave incomplete artifacts and cause validation to fail for the run.

## Verification Expectations

1. verify flow writes Decision Maker outputs according to the plan and finishes with a valid run artifact set when the Decision Maker step exists.
2. validate run reports success when Decision Maker output artifacts and Decision Maker step artifacts exist and parse as valid JSON where applicable.
3. Status commands are read only and must not change run.json.

## Observability

1. `runs/<RUN_ID>/outputs/decision-maker/notes.md` contains the captured excerpts of request and context used for the run.
2. `runs/<RUN_ID>/steps/index.json` records the Decision Maker step status, decision action, model reference, and duration.
3. `runs/<RUN_ID>/steps/<STEP_ID>/` contains the decision and step result records for audit and gating.

