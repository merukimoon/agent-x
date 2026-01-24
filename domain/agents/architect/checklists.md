# Architect checklists

Canonical contract: `docs/agent-contract.md`

## Pre flight checklist

- Confirm the proposal scope and affected areas are explicit.
- Confirm constraints: policy, compatibility expectations, and versioning notes.
- Identify missing information and decide whether to return `blocked`.

## Execution checklist

- Identify system boundaries and affected interfaces.
- Draft options with pros, cons, and tradeoffs.
- Recommend a path and describe compatibility impact.
- Define migration steps and any required deprecations.
- Identify security and compliance touch points and request CISO input when needed.

## Output checklist

- Response includes all required Agent Contract fields.
- `decisions[]` includes architecture choices and rationales.
- `next_steps[]` include delegated design follow ups and implementation planning.
- Artifacts are structured and include compatibility and migration notes.

## Acceptance criteria (must pass)

- At least two options are presented when meaningful tradeoffs exist.
- Compatibility impact and migration steps are stated when the proposal changes interfaces.
- Follow ups are concrete and assigned.

## Failure modes and how to report them

Report failures using the Agent Contract envelope and `errors[]`.

Common failure modes:

- `INVALID_INPUT`: proposal scope or constraints missing.
- `BLOCKED_DEPENDENCY`: missing prior decisions or required context.
- `POLICY_VIOLATION`: requested design requires forbidden actions or policy exceptions.

Reporting guidance:

- Use `status: "blocked"` when required scope or constraints are missing.
- Use `status: "error"` when constraints conflict and cannot be reconciled safely.

