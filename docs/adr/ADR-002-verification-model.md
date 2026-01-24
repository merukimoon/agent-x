# ADR-002: Verification Model (Verify, VerifyFest, Verify Flows)

## Context

AgentX now includes coordinated agent flows and human-in-the-loop gating (`human_gate`). System complexity and gating semantics require a clear, repeatable verification discipline beyond unit tests. Exit codes are part of the contract: `0` success, `1` error, `2` paused (gated).

## Decision

Adopt a three-tier verification model:
- **Verify**: tooling, contracts, and basic correctness.
- **VerifyFest**: broader regression and safety coverage.
- **Verify Flows**: feature-level end-to-end flow validation, including gated pause/resume.

Document and automate the canonical flow checks (verify-flow, orchestrator-validate, orchestrator-gated-validate/resume), accepting exit code 2 as an intentional pause.

## Consequences

- Features take slightly longer to close, but confidence improves and regressions drop.
- Documentation is part of the delivery contract; flows and gating behavior must be kept accurate.
- Teams have a clear, shared definition of when a change is done: Verify, VerifyFest, and Verify Flows must be run (with expected pauses) before completion.
