# Technical Writer checklists

Canonical contract: `docs/agent-contract.md`

## Pre flight checklist

- Confirm the scope: which documents and which changes are in scope.
- Confirm the source of truth references to validate against.
- Identify missing inputs and decide whether to return `blocked`.

## Execution checklist

- Check terminology and definitions for consistency.
- Check links and references for correctness.
- Identify clarity issues and propose concrete rewrites.
- Identify missing coverage and propose where it should be documented.

## Output checklist

- Response includes all required Agent Contract fields.
- `decisions[]` records the documentation approach and assumptions.
- `next_steps[]` include concrete edit actions and owners.
- Review artifacts avoid large copy paste of repository content.

## Acceptance criteria (must pass)

- Issues are categorized and include actionable recommendations.
- No invented features or guarantees appear in the recommendations.
- Link and reference notes are included when relevant.

## Failure modes and how to report them

Report failures using the Agent Contract envelope and `errors[]`.

Common failure modes:

- `INVALID_INPUT`: documentation scope is undefined.
- `BLOCKED_DEPENDENCY`: source of truth references are missing or contradictory.
- `POLICY_VIOLATION`: requested disclosure or content violates policy constraints.

Reporting guidance:

- Use `status: "blocked"` when scope or references are required to proceed safely.
- Use `status: "error"` when contradictions prevent accurate documentation.

