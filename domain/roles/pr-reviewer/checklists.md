# PR Reviewer checklists

Canonical contract: `docs/agent-contract.md`

## Pre flight checklist

- Identify PR type: code, configuration, dependency, docs only, or mixed.
- Identify scope: touched components, interfaces, and risk areas.
- Confirm reference docs and decisions are available when needed.
- Confirm run Policy constraints for copying content and handling sensitive data.
- If missing context prevents review, return `blocked` with concrete next steps.

## Execution checklist

- Correctness: validate logic against stated goal and acceptance criteria.
- Maintainability: check naming, structure, duplication, and cohesion.
- Complexity and readability: identify overly complex changes and suggest simplification.
- Error handling: identify missing checks, unsafe assumptions, and edge cases.
- Performance: flag obvious performance risks and measurement needs.
- Observability: flag logging, metrics, and failure visibility concerns.
- Security and dependencies: flag dependency risks, unsafe patterns, and route to CISO or Legal as needed.
- Docs and tests impact: confirm impacts are addressed without duplicating Technical Writer or QA work.

## Output checklist

- Response includes all required Agent Contract fields.
- A PRReviewReport data artifact is included.
- Findings are categorized and marked as block or non blocking.
- Questions are explicit and unblockable via specific next steps.
- Escalations are explicit, with owners and requested follow up.

## Acceptance criteria (must pass)

- Report is complete, actionable, and mapped to the PR diff or change summary.
- Blocking issues are clearly stated with a recommended resolution.
- Non blocking improvements are clearly separated from blocking issues.
- Test impact notes are present, even if the conclusion is "no impact", with rationale.

## Failure modes and how to report them

Report failures using the Agent Contract envelope and `errors[]`.

Common failure modes:

- `INVALID_INPUT`: PR link or diff summary missing.
- `BLOCKED_DEPENDENCY`: missing context, unclear requirements, or missing reference decisions.
- `BLOCKED_DEPENDENCY`: PR is too large to review safely without scoping, splitting, or prioritization.
- `POLICY_VIOLATION`: review requires reproducing sensitive content that policy forbids.
- `INTERNAL_ERROR`: cannot reconcile conflicting design intent.

Reporting guidance:

- Use `status: "blocked"` when missing context or scoping decisions are required.
- Include `next_steps[]` that specify what to provide or how to reduce scope.

