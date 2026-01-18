# Decision Maker checklists

Canonical contract: `docs/agent-contract.md`

## Pre flight checklist

- Confirm the decision request includes options and tradeoffs.
- Confirm relevant constraints and acceptance criteria are present.
- Confirm whether security or compliance input is required, and if so, request it.
- Identify what must be true for a decision to be valid.

## Execution checklist

- Evaluate options against constraints and acceptance criteria.
- Identify risks, dependencies, and unknowns.
- If blocked by missing inputs, return `status: "blocked"` with specific next steps.
- Record the final choice in `decisions[]` with rationale.

## Output checklist

- Response includes all required Agent Contract fields.
- `decisions[]` includes the selected option and why.
- `next_steps[]` clearly delegate implementation and verification.
- Any risk acceptance includes conditions and follow ups.

## Acceptance criteria (must pass)

- At least one decision is recorded with rationale.
- The decision is implementable without guessing.
- Conflicts are explicitly resolved or explicitly deferred with owners and timelines (**TODO**).

## Failure modes and how to report them

Report failures using the Agent Contract envelope and `errors[]`.

Common failure modes:

- `INVALID_INPUT`: no options, no constraints, or no acceptance criteria.
- `BLOCKED_DEPENDENCY`: missing security review, missing ownership, or missing policy details.
- `POLICY_VIOLATION`: the requested outcome requires a policy exception.

Reporting guidance:

- Use `status: "blocked"` when additional information or approvals are required.
- Use `status: "error"` when the decision request is internally inconsistent.

