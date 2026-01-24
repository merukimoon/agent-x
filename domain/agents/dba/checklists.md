# DBA checklists

Canonical contract: `docs/agent-contract.md`

## Pre flight checklist

- Confirm the data model change request and acceptance criteria are present.
- Confirm any known query patterns and workload assumptions.
- Identify missing inputs and decide whether to return `blocked`.

## Execution checklist

- Review schema changes for correctness and maintainability.
- Review indexes and query patterns for performance risk.
- Draft migration steps and a rollback plan.
- Identify integrity risks and verification steps.
- Note operational constraints that affect deployment.

## Output checklist

- Response includes all required Agent Contract fields.
- `decisions[]` records the recommended data layer approach and assumptions.
- `next_steps[]` includes concrete implementation and verification actions.
- Artifacts include migration plan, rollback plan, and risk list.

## Acceptance criteria (must pass)

- Migration plan and rollback plan are present when schema changes are proposed.
- Performance considerations are addressed when query patterns are in scope.
- Risks and mitigations are enumerated.

## Failure modes and how to report them

Report failures using the Agent Contract envelope and `errors[]`.

Common failure modes:

- `INVALID_INPUT`: missing schema change description or acceptance criteria.
- `BLOCKED_DEPENDENCY`: missing query patterns, workload assumptions, or constraints.
- `POLICY_VIOLATION`: requested access to sensitive data or forbidden actions.

Reporting guidance:

- Use `status: "blocked"` when workload details are required to provide safe guidance.
- Use `status: "error"` when inputs are inconsistent or unsafe to interpret.

