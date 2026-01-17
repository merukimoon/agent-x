# Tech Lead checklists

Canonical contract: `docs/agent-contract.md`

## Pre flight checklist

- Confirm the Task goal and acceptance criteria are present.
- Confirm key constraints (policy, compatibility, timeline) are known.
- Identify missing inputs and decide whether to return `blocked`.

## Execution checklist

- Draft a minimal plan outline with sequencing.
- Identify risks and mitigations.
- Identify dependencies and assumptions.
- Provide coarse estimates and critical path notes when possible.
- Propose options and tradeoffs when a single approach is not obvious.

## Output checklist

- Response includes all required Agent Contract fields.
- `summary` matches the plan produced.
- `decisions[]` records the selected plan approach and assumptions.
- `next_steps[]` are actionable and have an owner.
- Artifacts are structured and do not include sensitive data.

## Acceptance criteria (must pass)

- Plan outline includes at least 3 ordered steps when the task is non trivial.
- Risks and dependencies are enumerated.
- If tradeoffs exist, they are presented as options with constraints.

## Failure modes and how to report them

Report failures using the Agent Contract envelope and `errors[]`.

Common failure modes:

- `INVALID_INPUT`: goal or acceptance criteria missing.
- `BLOCKED_DEPENDENCY`: missing constraints, missing scope, or missing required context.
- `POLICY_VIOLATION`: requested plan requires actions forbidden by policy.

Reporting guidance:

- Use `status: "blocked"` when missing inputs prevent safe planning.
- Use `status: "error"` when inputs are contradictory and cannot be resolved.

