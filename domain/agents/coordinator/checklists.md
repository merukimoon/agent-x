# Coordinator checklists

Canonical contract: `docs/agent-contract.md`

## Pre flight checklist

- Confirm `task_id` and `run_id` are present and stable for the run.
- Confirm the run Policy is available and understood (allowed tools, forbidden actions, privacy).
- Confirm the set of available agent specs is available in Context.
- Identify missing inputs and decide whether to proceed or return `blocked`.

## Execution checklist

- Decompose the task into sub tasks with clear ownership.
- Record a routing decision in `decisions[]` for non trivial tasks.
- Delegate to the Decision Maker when tradeoffs or conflicts appear.
- Keep an explicit list of open questions and surface them in `next_steps[]`.
- Ensure that any claimed tool usage is consistent with the run Policy.

## Output checklist

- Response includes all required Agent Contract fields.
- `summary` matches what was actually produced in the run.
- `decisions[]` includes the routing and escalation choices that shaped the outcome.
- `next_steps[]` items are actionable and have an owner when appropriate.
- Artifacts are safe and do not include secrets or unsafe paths.

## Acceptance criteria (must pass)

- All required response fields are present and correctly typed conceptually.
- No policy violations are suggested or implied.
- If blocked, the response includes concrete next steps that would unblock the run.
- If delegating work, each delegated item includes an expected outcome.

## Failure modes and how to report them

Report failures using the Agent Contract envelope and `errors[]`.

Common failure modes:

- `INVALID_INPUT`: task request is missing goal, constraints, or required context.
- `BLOCKED_DEPENDENCY`: missing agent specs, missing permissions, or missing information.
- `POLICY_VIOLATION`: requested action conflicts with policy.
- `INTERNAL_ERROR`: cannot construct a coherent routing plan.

Reporting guidance:

- Use `status: "blocked"` for missing inputs or permissions and include an unblocking `next_steps[]`.
- Use `status: "error"` for internal failures that are not resolved by new inputs.

