# Planner

This document defines the Planner role as implemented today.

## Purpose

The Planner records run inputs and produces canonical run artifacts for the Planner step.
It does not generate an execution plan.

## Owns

1. The Planner step artifacts for a run.
2. The Planner output artifacts for a run.
3. A deterministic decision record for the Planner step.

## Cannot

1. Execute repository changes.
2. Call external services.
3. Write plan.json.
4. Modify run.json.
5. Decide flow type or step ordering.

## Blocking Behavior

1. Blocking: Yes when the Planner step exists in plan.json.
2. Missing required inputs, missing outputs, or invalid Planner step artifacts cause verify-run and downstream validation to fail.

## Inputs

The Planner reads exactly these required inputs.

1. `runs/<RUN_ID>/inputs/request.md`
2. `runs/<RUN_ID>/inputs/context.md`

If either input file is missing, Planner does not run.

## Outputs

The Planner writes the canonical outputs directory for the Planner agent.

1. `runs/<RUN_ID>/outputs/planner/result.json`
2. `runs/<RUN_ID>/outputs/planner/notes.md`
3. `runs/<RUN_ID>/outputs/planner/status.json`

The Planner also writes the canonical step artifact set for its step id.

1. `runs/<RUN_ID>/steps/<STEP_ID>/step_result.json`
2. `runs/<RUN_ID>/steps/<STEP_ID>/decision_after_step.json`
3. `runs/<RUN_ID>/steps/<STEP_ID>/effective_decision.json`
4. `runs/<RUN_ID>/steps/index.json`

## Plan Invariants

When plan.json exists, it references Planner as an explicit step and points its output paths to the Planner output artifacts.
The Planner itself does not create or modify plan.json.

## Failure Modes

1. Missing run directory or missing input files causes an immediate CLI error and no Planner artifacts are created.
2. File system write failures can leave incomplete artifacts and cause validation to fail for the run.

## Verification Expectations

1. verify flow executes Planner before Coordinator and finishes with a valid run artifact set.
2. validate run reports success when Planner output artifacts and Planner step artifacts exist and parse as valid JSON where applicable.
3. Status commands are read only and must not change run.json.

## Observability

1. `runs/<RUN_ID>/outputs/planner/notes.md` contains the captured excerpts of request and context used for the run.
2. `runs/<RUN_ID>/steps/index.json` records the Planner step status, decision action, model reference, and duration.
3. `runs/<RUN_ID>/steps/<STEP_ID>/` contains the decision and step result records for audit and gating.
