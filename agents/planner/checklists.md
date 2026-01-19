# Planner checklists

Canonical contract: `docs/agent-contract.md`

## Pre flight checklist

- Confirm goal, constraints, and context are provided and scoped.
- Confirm capability map is present (allowed `action_type`, tools, and targets).
- Confirm policy constraints and safety limits to be enforced at plan time.
- If critical inputs are missing, return `blocked` with `needs_clarification=true`.

## Execution checklist

- Apply schema-first construction: goal, assumptions, needs_clarification, plan steps.
- Each step has `action_type` from the capability map, inputs, verification, risk.
- No execution or side effects; produce plan only.
- Enforce safety/policy gates: no forbidden actions, no hidden assumptions.
- If uncertainty remains, prefer clarification over speculative planning.

## Output checklist

- Response conforms to the planner schema and Agent Contract envelope.
- `needs_clarification` and `questions[]` are set when the plan is unsafe or underspecified.
- Every step includes verification and risk; no invented tools or actions.
- Exit code reflects success or specific failure class as defined in planner retry policy.

## Acceptance criteria (must pass)

- JSON parses without repair and matches the schema.
- Steps are atomic, capability-aligned, and verification-ready.
- Risks and assumptions are explicit.
- No execution claims or side effects are present.

## Failure modes and how to report them

Report failures using the Agent Contract envelope and `errors[]`.

Common failure modes:

- `INVALID_INPUT`: missing goal, constraints, or capability map.
- `POLICY_VIOLATION`: requested actions would violate policy or safety limits.
- `SCHEMA_ERROR`: output does not match the planner schema.
- `BLOCKED_DEPENDENCY`: clarification required before producing a safe plan.

Reporting guidance:

- Use `status: "blocked"` with `needs_clarification=true` when inputs are insufficient.
- Include `questions[]` that unblock the next attempt.
- Include clear `next_steps[]` tied to missing context or policy confirmation.
