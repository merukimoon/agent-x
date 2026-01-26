# Coordinator

This document defines the Coordinator role as implemented today.

## Purpose

The Coordinator constructs plan.json for a run and writes the Coordinator step artifacts.
It classifies the flow, expands rule pack steps, and materializes dependencies for the execution engine.
It does not execute user work.

## Owns

1. plan.json for the run when it is missing.
2. The Coordinator step artifacts for a run.
3. The Coordinator output artifacts for a run.
4. A deterministic decision record for the Coordinator step.

## Cannot

1. Execute repository changes.
2. Call external services.
3. Modify run.json.
4. Alter existing step statuses beyond writing a fresh plan when absent.
5. Bypass gating or dependency validation.

## Blocking Behavior

1. Blocking: Yes when the Coordinator step exists in plan.json.
2. Missing required inputs, missing outputs, or invalid Coordinator step artifacts cause verify-run and downstream validation to fail.

## Inputs

The Coordinator reads exactly these required inputs.

1. `runs/<RUN_ID>/inputs/request.md`
2. `runs/<RUN_ID>/inputs/context.md`
3. Prior outputs referenced by step dependencies when present.

If any required input file is missing, Coordinator does not run.

## Outputs

The Coordinator writes the canonical outputs directory for the Coordinator agent.

1. `runs/<RUN_ID>/outputs/coordinator/result.json`
2. `runs/<RUN_ID>/outputs/coordinator/notes.md`
3. `runs/<RUN_ID>/outputs/coordinator/status.json`

The Coordinator also writes the canonical step artifact set for its step id.

1. `runs/<RUN_ID>/steps/<STEP_ID>/step_result.json`
2. `runs/<RUN_ID>/steps/<STEP_ID>/decision_after_step.json`
3. `runs/<RUN_ID>/steps/<STEP_ID>/effective_decision.json`
4. `runs/<RUN_ID>/steps/index.json`

## Invariants

1. plan.json lists Planner and Coordinator steps with status done and allow skip true.
2. plan.json maps rule pack steps to agents with depends_on resolved to step ids, not agent names.
3. plan.json outputs paths for each step match the canonical outputs folder for that agent.
4. Coordinator does not overwrite an existing plan.json unless it is missing.

## Run Artifacts

1. Produces plan.json when absent and writes `runs/<RUN_ID>/outputs/coordinator/result.json`, `runs/<RUN_ID>/outputs/coordinator/notes.md`, and `runs/<RUN_ID>/outputs/coordinator/status.json`.
2. Produces `runs/<RUN_ID>/steps/<STEP_ID>/step_result.json`, `runs/<RUN_ID>/steps/<STEP_ID>/decision_after_step.json`, `runs/<RUN_ID>/steps/<STEP_ID>/effective_decision.json`, and updates `runs/<RUN_ID>/steps/index.json`.
3. Reads `runs/<RUN_ID>/inputs/request.md`, `runs/<RUN_ID>/inputs/context.md`, and any prior outputs referenced in depends_on once resolved.

### Observability

1. `runs/<RUN_ID>/outputs/coordinator/notes.md` records the excerpts of request and context used by the Coordinator.
2. `runs/<RUN_ID>/outputs/coordinator/status.json` and `runs/<RUN_ID>/steps/index.json` show the Coordinator step status, model reference, and duration.
3. `runs/<RUN_ID>/steps/<STEP_ID>/` holds the step decision and result records used by verify-run and status commands; plan.json shows the resolved steps and dependencies.

## Failure Modes

1. Missing run directory or missing input files causes an immediate CLI error and no Coordinator artifacts are created.
2. Dependency resolution errors halt plan creation and emit errors to stderr.
3. File system write failures can leave incomplete artifacts and cause validation to fail for the run.

## Verification Expectations

1. verify flow writes plan.json via Coordinator when absent and finishes with a valid run artifact set.
2. validate run reports success when Coordinator output artifacts, Coordinator step artifacts, and plan.json exist and parse as valid JSON where applicable.
3. Status commands are read only and must not change run.json.

## Definition of Done

1. plan.json exists and reflects the Coordinator outputs with resolved depends_on and canonical output paths for each step.
2. `runs/<RUN_ID>/outputs/coordinator/result.json`, `notes.md`, and `status.json` exist and parse as valid JSON where applicable.
3. `runs/<RUN_ID>/steps/<STEP_ID>/` contains step_result.json, decision_after_step.json, effective_decision.json, and steps/index.json records the Coordinator step with a non pending status consistent with the artifacts.
4. verify-run or validate-run on the run completes without errors attributable to the Coordinator step.
