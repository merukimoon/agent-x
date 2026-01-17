# CISO checklists

Canonical contract: `docs/agent-contract.md`

## Pre flight checklist

- Confirm the review scope: which artifacts and which baseline docs are in scope.
- Confirm the run Policy, especially network, memory, and logging constraints.
- Identify missing inputs needed to complete review and decide whether to return `blocked`.

## Execution checklist

- Check for secret leakage risks and data handling gaps.
- Check for unsafe guidance that could bypass policy or tool boundaries.
- Check licensing and disclosure touch points (LICENSE, SECURITY.md, CODE_OF_CONDUCT.md).
- Classify each finding as warning or block with severity.
- Draft remediation steps that are specific and assignable.

## Output checklist

- Response includes all required Agent Contract fields.
- A `SecurityComplianceReport` data artifact is included.
- `decisions[]` records the classification logic for any blocking findings.
- `next_steps[]` includes remediation tasks with owners.
- Report avoids including sensitive content beyond what is necessary.

## Acceptance criteria (must pass)

- The report includes an `overall_status` and a non empty findings list when issues exist.
- Blocking findings include evidence and a recommended mitigation.
- No secrets or sensitive personal data are included in report artifacts or logs.

## Failure modes and how to report them

Report failures using the Agent Contract envelope and `errors[]`.

Common failure modes:

- `INVALID_INPUT`: no artifacts to review, or scope is undefined.
- `BLOCKED_DEPENDENCY`: missing baseline docs, missing policy, or missing artifact contents.
- `INTERNAL_ERROR`: cannot complete classification due to inconsistent inputs.

Reporting guidance:

- Use `status: "blocked"` when additional artifacts or scope details are required.
- Use `status: "error"` when the input set is inconsistent and cannot be interpreted safely.

