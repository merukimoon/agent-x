# Legal checklists

Canonical contract: `docs/agent-contract.md`

## Pre flight checklist

- Confirm the review scope: which artifacts and which distribution expectations are in scope.
- Confirm the repository license and related docs are available.
- Identify missing inputs and decide whether to return `blocked`.

## Execution checklist

- Review license files and notice requirements.
- Identify third party assets or dependencies in scope and request license info if missing.
- Classify findings as blocking or warning.
- Draft remediation steps and required notices.

## Output checklist

- Response includes all required Agent Contract fields.
- A LicenseComplianceReport data artifact is included.
- `decisions[]` record classification for blocking findings with rationale.
- `next_steps[]` include concrete remediation actions and owners.

## Acceptance criteria (must pass)

- The report includes `overall_status` and findings when issues exist.
- Blocking findings include a concrete recommendation.
- Unknowns and missing information are explicitly stated.

## Failure modes and how to report them

Report failures using the Agent Contract envelope and `errors[]`.

Common failure modes:

- `INVALID_INPUT`: scope is undefined or licensing docs are missing.
- `BLOCKED_DEPENDENCY`: missing dependency license information when required.
- `INTERNAL_ERROR`: cannot classify due to inconsistent scope assumptions.

Reporting guidance:

- Use `status: "blocked"` when required licensing information is missing.
- Use `status: "error"` when the scope is inconsistent and cannot be interpreted safely.

