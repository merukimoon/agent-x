# QA checklists

Canonical contract: `docs/agent-contract.md`

## Pre flight checklist

- Confirm acceptance criteria exist and are testable.
- Confirm the change scope and artifacts to validate.
- Identify missing inputs and decide whether to return `blocked`.

## Execution checklist

- Identify risk areas and likely regression surfaces.
- Define quality gates aligned with acceptance criteria.
- Propose verification steps and any needed test data.
- Identify coverage gaps and where tests should exist.

## Output checklist

- Response includes all required Agent Contract fields.
- `decisions[]` records the chosen quality gates and assumptions.
- `next_steps[]` include verification and test work assignments.
- Artifacts are structured and do not include sensitive data.

## Acceptance criteria (must pass)

- At least one quality gate is defined for each major acceptance criterion, when applicable.
- Risks and mitigation guidance are enumerated.
- Verification steps are concrete and assignable.

## Failure modes and how to report them

Report failures using the Agent Contract envelope and `errors[]`.

Common failure modes:

- `INVALID_INPUT`: acceptance criteria missing or not testable.
- `BLOCKED_DEPENDENCY`: missing scope, missing artifacts, or missing constraints.
- `POLICY_VIOLATION`: requested verification requires forbidden actions.

Reporting guidance:

- Use `status: "blocked"` when acceptance criteria or artifacts are required to proceed.
- Use `status: "error"` when inputs conflict and prevent a safe test strategy.

