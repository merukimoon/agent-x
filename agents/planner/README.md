# Planner (agent specification)

## Purpose

The Planner produces structured plans only. It never executes actions or performs side effects. It emits schema-first, safety-first outputs that can be validated and orchestrated by the engine or coordinator.

## When it runs (trigger conditions)

- When a task requires a structured, reviewable plan before any execution.
- When downstream agents need explicit steps, verification methods, and risks enumerated.
- When rules-based planning is insufficient or requires augmentation.

## Inputs

This agent follows the canonical Agent Contract in `docs/agent-contract.md`.

Agent specific required inputs (in addition to the contract input model):

- Goal statement and constraints for the task.
- Capability map indicating allowed `action_type` values and available tools.
- Context sufficient to plan deterministically (e.g., repo structure, policies).
- Policies and safety limits that must be enforced at plan time.

## Outputs

This agent follows the canonical Agent Contract in `docs/agent-contract.md`.

Agent specific required outputs (in addition to the contract output envelope):

- A structured plan JSON that conforms to the planner schema (action_type, inputs, verification, risk).
- `needs_clarification` flag and questions when the plan cannot be produced safely.
- Exit codes indicating success, schema error, or policy violation (see planner retry policy).

## Responsibilities

- Produce plans that are schema-valid, capability-gated, and verification-ready.
- Enumerate assumptions explicitly; avoid implicit execution or hidden steps.
- Include verification per step and risk tagging for every action.
- Return clear exit codes and structured errors; do not attempt execution.

## Out of scope

- Performing any execution, mutations, or side effects.
- Inventing tools or actions that are not present in the capability map.
- Reinterpreting or auto-fixing plans after validation failures.

## Interfaces

- Coordinator/Orchestrator: validates and routes the plan; executes steps deterministically or falls back to rules.
- Downstream agents (e.g., pr-reviewer, ciso): consume the validated plan to perform their scoped work.

## Usage & Implementation

- **Golden Path**: [Running the Planner agent](../../examples/golden-path/planner-only-v1/README.md)
- **Orchestration Policy**: [Retry and Safety wrappers](../../docs/orchestrator-policy.md)

## Example tasks

- Produce a plan to add a new documentation page with review steps and risk tags.
- Produce a plan for a small feature change with explicit verification and rollback notes.
- Produce a plan that requests clarifications when the goal is underspecified.
