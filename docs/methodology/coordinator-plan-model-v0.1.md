# Coordinator Plan Model – Draft v0.1

## Status
- Draft
- Reflects system after Step 2 (plan-driven execution produced by coordinator)

## Problem Statement
- Provide deterministic, explicit execution ordering for multiple agents within a run.
- Replace implicit or hardcoded sequencing with a declarative plan that is inspectable and auditable.
- Ensure downstream agents have declared dependencies and required inputs before they execute.

## Core Concepts
- **Run**: Bounded execution instance holding inputs, outputs, and the plan governing agents.
- **Agent**: Role-specific worker that produces notes and structured results for a run.
- **Coordinator**: Agent that inspects run inputs and emits the plan defining execution order and dependencies for other agents.
- **Engine**: Runtime component that reads the plan and executes agents strictly according to that plan.
- **Plan**: Machine-readable artifact describing ordered steps, dependencies, and canonical outputs for a run.
- **Step**: Planned execution of a specific agent with declared dependencies, inputs, outputs, and status.

## Execution Phases
- **Planning phase (Coordinator)**: Coordinator reads run inputs and emits the plan describing subsequent steps, dependencies, and outputs.
- **Execution phase (Engine)**: Engine consumes the plan and executes steps in the defined order while respecting dependencies.

## Coordinator Responsibilities
- Decide which agents should run and in what order.
- Declare dependencies between agents via plan steps.
- Produce the plan that lists steps, dependencies, and expected outputs.
- Does NOT execute other agents.
- Does NOT reorder steps during execution.
- Does NOT apply retries or conditional branching.

## Plan (plan.json)
- Purpose: Single source of truth for execution order, dependencies, and expected outputs for a run.
- Schema (high level): Plan metadata (run id, version, created_at) plus an ordered list of steps. Each step specifies id, agent, depends_on agents, required inputs, canonical outputs, and status.
- Steps and dependencies: depends_on indicates which agents must complete before the step may run.
- Statuses: pending, running, done, failed, skipped; they track lifecycle of each planned execution.
- Canonical outputs: Each step points to the agent’s result and notes locations; the engine relies on these paths and does not infer alternatives.

## Engine Responsibilities
- Validate the plan structure before execution.
- Enforce declared execution order and dependencies.
- Execute each step’s agent when dependencies are satisfied.
- Update step status to reflect progress and completion.
- Does NOT invent new steps or change ordering.
- Does NOT change target output locations.
- Does NOT decide which agents to run; it follows the plan.

## Invariants
- Plan is created before execution begins.
- Engine never reorders steps.
- Execution follows plan.json strictly; no hidden sequencing.
- Steps run only when declared dependencies are satisfied.
- Outputs are written only to canonical locations referenced in the plan.
- Plan statuses reflect real execution progress for every step.

## Non-Goals (Explicit)
- Parallel execution.
- Automatic retries.
- Conditional branching within the plan.
- UI or visualization layers.
- Provider-specific or model-specific behaviors.

## Evolution Notes
- Upcoming themes (Step 3 and beyond): retries, skip controls, stronger validation, clearer status visibility.
- Future changes should preserve backward compatibility with this plan-first model or introduce explicit versioning when breaking changes are required.

## Summary
Two-phase flow: the coordinator produces a plan listing ordered, dependency-aware steps; the engine executes those steps exactly as defined. The plan remains the single source of truth for execution order, required inputs, and canonical outputs, enabling deterministic and auditable runs without implicit sequencing.
