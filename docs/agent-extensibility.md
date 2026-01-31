# Agent Extensibility Guide

This guide explains how to add or adjust agents in AgentX without weakening guarantees. It describes current behavior only.

## What an agent is

1. An agent is a responsibility boundary that reads run inputs and prior outputs and writes its own outputs and step artifacts.
2. Agents conform to the Agent Contract at `docs/agent-contract.md` and the role contract checklist at `docs/roles/role-contract-checklist.md`.
3. Agents are orchestrated through plan.json and run.json; they are not plugins and they do not bypass policy or verification.

## Preconditions for adding a new agent

1. A new role directory under `domain/roles/<agent-name>/` exists with a README that follows the checklist structure.
2. The run rules and plan schema already allow referencing the agent by name and defining its outputs; do not extend the schema ad hoc.
3. Required inputs are available under `runs/<RUN_ID>/inputs/` or from prior outputs listed in depends_on.
4. Verification commands `make verify-flow`, `make validate-run`, and `pnpm exec agentic verify-run` remain applicable without special flags.

## Defining responsibilities and artifacts

1. Describe the role in Purpose, Owns, Cannot, Inputs, Outputs, Invariants, Failure Modes, Verification Expectations, Observability, and Blocking Behavior sections.
2. Outputs must live under `runs/<RUN_ID>/outputs/<agent>/` and include result.json, notes.md, and status.json unless a contract states otherwise.
3. Step artifacts must live under `runs/<RUN_ID>/steps/<STEP_ID>/` and include step_result.json, decision_after_step.json, effective_decision.json, and the shared steps/index.json record.
4. Invariants must tie plan.json paths to the agent’s outputs and declare dependency relationships through depends_on.

## Verification and enforcement

1. verify flow creates a run, executes the configured agents in order, and writes artifacts; it fails if any required artifact is missing or invalid.
2. validate run and verify-run read an existing run and fail when outputs, statuses, or references are missing or malformed.
3. Status commands are read only; they must not change run.json. Any drift detected by hash comparison is treated as a failure.
4. A role is blocking when its step exists in plan.json; missing inputs or outputs cause verification failure and block the run.

## Observing and debugging agent behavior

1. Use `runs/<RUN_ID>/outputs/<agent>/notes.md` to review captured context and request excerpts.
2. Use `runs/<RUN_ID>/outputs/<agent>/status.json` and `runs/<RUN_ID>/steps/index.json` to see step status, model references, and duration.
3. Inspect `runs/<RUN_ID>/steps/<STEP_ID>/decision_after_step.json` and `effective_decision.json` to confirm decisions and routing.
4. Treat run.json and plan.json as authoritative; never edit them manually to mask verification failures.

## Forbidden patterns and common mistakes

1. Do not write plan.json or run.json from a role unless the role explicitly owns that responsibility.
2. Do not add optional or best effort outputs; every listed output must be written or verification will fail.
3. Do not call external services or mutate the repository from an agent step; agents produce guidance and artifacts only.
4. Do not register new inputs or outputs outside the canonical run directory structure.
5. Do not skip Blocking Behavior declarations; every role must state whether it blocks and why.
