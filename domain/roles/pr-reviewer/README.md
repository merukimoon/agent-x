# PR Reviewer

This document defines the PR Reviewer role as implemented today.

## Purpose

The PR Reviewer produces the PR Reviewer step artifacts and output artifacts for a run.
It reviews inputs and prior outputs for change quality and records review guidance.
It does not execute user work or modify plan.json.

## Owns

1. The PR Reviewer step artifacts for a run.
2. The PR Reviewer output artifacts for a run.
3. A deterministic decision record for the PR Reviewer step.

## Cannot

1. Execute repository changes.
2. Call external services.
3. Write or modify plan.json.
4. Modify run.json.
5. Change flow type or step ordering.

## Blocking Behavior

1. Blocking: Yes when the PR Reviewer step exists in plan.json.
2. Missing required inputs, missing outputs, or invalid PR Reviewer step artifacts cause verify-run and downstream validation to fail.

## Inputs

The PR Reviewer reads exactly these required inputs.

1. `runs/<RUN_ID>/inputs/request.md`
2. `runs/<RUN_ID>/inputs/context.md`
3. Prior outputs listed in the plan step depends_on chain.

If any required input file or prior output referenced by the step is missing, PR Reviewer does not run.

## Outputs

The PR Reviewer writes the canonical outputs directory for the PR Reviewer agent.

1. `runs/<RUN_ID>/outputs/pr-reviewer/result.json`
2. `runs/<RUN_ID>/outputs/pr-reviewer/notes.md`
3. `runs/<RUN_ID>/outputs/pr-reviewer/status.json`

The PR Reviewer also writes the canonical step artifact set for its step id.

1. `runs/<RUN_ID>/steps/<STEP_ID>/step_result.json`
2. `runs/<RUN_ID>/steps/<STEP_ID>/decision_after_step.json`
3. `runs/<RUN_ID>/steps/<STEP_ID>/effective_decision.json`
4. `runs/<RUN_ID>/steps/index.json`

## Invariants

1. Outputs paths in plan.json for the PR Reviewer step match the canonical PR Reviewer outputs folder.
2. PR Reviewer does not change step statuses other than writing its own step artifacts.

## Failure Modes

1. Missing run directory, inputs, or required prior outputs causes an immediate CLI error and no PR Reviewer artifacts are created.
2. File system write failures can leave incomplete artifacts and cause validation to fail for the run.

## Verification Expectations

1. verify flow writes PR Reviewer outputs according to the plan and finishes with a valid run artifact set when the PR Reviewer step exists.
2. validate run reports success when PR Reviewer output artifacts and PR Reviewer step artifacts exist and parse as valid JSON where applicable.
3. Status commands are read only and must not change run.json.

## Observability

1. `runs/<RUN_ID>/outputs/pr-reviewer/notes.md` contains the captured excerpts of request and context used for the run.
2. `runs/<RUN_ID>/steps/index.json` records the PR Reviewer step status, decision action, model reference, and duration.
3. `runs/<RUN_ID>/steps/<STEP_ID>/` contains the decision and step result records for audit and gating.

