# Data Scientist checklists

Canonical contract: `docs/agent-contract.md`

## Pre flight checklist

- Confirm the question and desired outcome are explicit.
- Confirm available data sources and constraints, or record them as unknown.
- Confirm privacy constraints and run Policy implications.
- Identify missing inputs and decide whether to return `blocked`.

## Execution checklist

- Define success metrics and guardrail metrics.
- Propose approach options and a recommended approach.
- Specify data requirements and potential instrumentation needs.
- Draft an experiment design and evaluation plan.
- Identify risks such as leakage, bias, and measurement error.

## Output checklist

- Response includes all required Agent Contract fields.
- `decisions[]` records the recommended approach and key assumptions.
- `next_steps[]` delegate data, instrumentation, and experiment actions.
- Artifacts include metrics, data requirements, and experiment plan.

## Acceptance criteria (must pass)

- Metrics are explicit and include evaluation guidance.
- Data requirements are listed and bounded by policy constraints.
- At least one risk and mitigation is documented.

## Failure modes and how to report them

Report failures using the Agent Contract envelope and `errors[]`.

Common failure modes:

- `INVALID_INPUT`: missing question, goal, or success criteria.
- `BLOCKED_DEPENDENCY`: unknown data availability or constraints.
- `POLICY_VIOLATION`: requested data access violates privacy constraints.

Reporting guidance:

- Use `status: "blocked"` when data constraints must be clarified to proceed.
- Use `status: "error"` when inputs are inconsistent or unsafe to interpret.

