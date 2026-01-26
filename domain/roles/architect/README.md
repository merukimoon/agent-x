# Architect

This document defines the Architect role as implemented today.

## Purpose

The Architect produces the Architect step artifacts and output artifacts for a run.
It reviews inputs and prior Planner outputs to record architecture guidance.
It does not execute user work or modify plan.json.

## Owns

1. The Architect step artifacts for a run.
2. The Architect output artifacts for a run.
3. A deterministic decision record for the Architect step.

## Cannot

1. Execute repository changes.
2. Call external services.
3. Write or modify plan.json.
4. Modify run.json.
5. Change flow type or step ordering.

## Inputs

The Architect reads exactly these required inputs.

1. `runs/<RUN_ID>/inputs/request.md`
2. `runs/<RUN_ID>/inputs/context.md`
3. Prior outputs listed in the plan step depends_on chain, typically Planner outputs.

If any required input file or prior output referenced by the step is missing, Architect does not run.

## Outputs

The Architect writes the canonical outputs directory for the Architect agent.

1. `runs/<RUN_ID>/outputs/architect/result.json`
2. `runs/<RUN_ID>/outputs/architect/notes.md`
3. `runs/<RUN_ID>/outputs/architect/status.json`

The Architect also writes the canonical step artifact set for its step id.

1. `runs/<RUN_ID>/steps/<STEP_ID>/step_result.json`
2. `runs/<RUN_ID>/steps/<STEP_ID>/decision_after_step.json`
3. `runs/<RUN_ID>/steps/<STEP_ID>/effective_decision.json`
4. `runs/<RUN_ID>/steps/index.json`

## Invariants

1. The Architect step in plan.json depends_on the Planner step and uses the Planner outputs as prior outputs.
2. Outputs paths in plan.json for the Architect step match the canonical Architect outputs folder.
3. Architect does not change step statuses other than writing its own step artifacts.

## Failure Modes

1. Missing run directory, inputs, or required prior outputs causes an immediate CLI error and no Architect artifacts are created.
2. File system write failures can leave incomplete artifacts and cause validation to fail for the run.

## Verification Expectations

1. verify flow writes Architect outputs when the Architect step is present in the plan and finishes with a valid run artifact set.
2. validate run reports success when Architect output artifacts and Architect step artifacts exist and parse as valid JSON where applicable.
3. Status commands are read only and must not change run.json.

## Observability

1. `runs/<RUN_ID>/outputs/architect/notes.md` contains the captured excerpts of request and context used for the run.
2. `runs/<RUN_ID>/steps/index.json` records the Architect step status, decision action, model reference, and duration.
3. `runs/<RUN_ID>/steps/<STEP_ID>/` contains the decision and step result records for audit and gating.
