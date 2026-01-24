# ADR-001: Terminology & Linkage Alignment

Date: 2026-01-19
Status: Accepted

## Context
As the framework evolved, ambiguity emerged regarding the definition and role of the "Planner". It was variously described as a "mode" of the system or a distinct agent. Similarly, the "Orchestrator" was sometimes conflated with agent behavior rather than its true role as a runtime control layer.

Additionally, documentation layout created a discoverability gap: agent specifications lived in `domain/agents/`, but the canonical "how-to-run" guides (Golden Paths) lived in `examples/` or `docs/`, with no direct linkage between specification and implementation.

## Decision
1. **Planner is a First-Class Agent**: The Planner is formally defined as an agent that produces structured plans without side effects. It is not merely a "mode".
2. **Orchestrator is Runtime, Not Agent**: The Orchestrator is explicitly defined as the control layer that enforces policy and runtime behavior. It is not an agent.
3. **Terminology Standardization**: The phrase "Planner-only mode" is deprecated in favor of "running the Planner agent in isolation".
4. **Linkage Mandate**: Agent specifications (e.g., `domain/agents/planner/README.md`) must explicitly link to their canonical usage guides (Golden Paths) and policy documentation.

## Consequences
### Positive
- **Clear Mental Model**: Contributors can clearly distinguish between the "who" (Agent) and the "how" (Orchestrator runtime).
- **Discoverability**: Developers reading an agent spec can immediately find the supported way to run and verify it.
- **Consistency**: Removed conflicting definitions across the repository.

### Trade-offs
- **Duplication**: Links to Golden Paths now exist in both the root README and agent READMEs, requiring synchronized updates if paths change.
