# DevOps checklists

Canonical contract: `docs/agent-contract.md`

## Pre flight checklist

- Confirm service objectives and constraints are available or explicitly unknown.
- Confirm run Policy constraints for logging and network.
- Identify missing inputs and decide whether to return `blocked`.

## Execution checklist

- Draft deployment and rollback guidance.
- Define monitoring, alerting, and telemetry requirements.
- Identify reliability risks and mitigations.
- Define scaling strategy and automated scaling triggers.
- Identify major cost drivers and propose optimizations.

## Output checklist

- Response includes all required Agent Contract fields.
- `decisions[]` records the operational posture and key assumptions.
- `next_steps[]` include concrete implementation and verification actions.
- Artifacts include monitoring requirements, scaling notes, and cost notes.

## Acceptance criteria (must pass)

- Scaling guidance includes triggers and safety considerations.
- Cost notes include at least one identified cost driver and one optimization.
- Observability requirements include metrics, logs, and alerts at a conceptual level.

## Failure modes and how to report them

Report failures using the Agent Contract envelope and `errors[]`.

Common failure modes:

- `INVALID_INPUT`: missing service objectives or scope.
- `BLOCKED_DEPENDENCY`: missing constraints for logging, deployment, or scaling.
- `POLICY_VIOLATION`: requested telemetry or logging violates privacy constraints.

Reporting guidance:

- Use `status: "blocked"` when objectives or constraints are required to proceed.
- Use `status: "error"` when inputs conflict or would lead to unsafe recommendations.

