# Agents (specifications)

This directory contains **domain/business agent specifications**: the stable, reviewable definition of what each agent is responsible for and how it behaves. These are not external coding assistants; see the root `AGENTS.md` for external assistant guidance.

This is **not** where implementation code lives. Until a runtime/language is chosen, treat everything here as contract- and policy-level documentation.

## What an “agent directory” represents

Create one folder per agent:

```text
domain/roles/<agent-name>/
```

That folder represents a single agent identity that can participate in a run (e.g., `planner`, `executor`, `reviewer`).

## Expected contents per agent (recommended)

An agent folder SHOULD contain:

- `README.md` Purpose, scope, responsibilities, and non goals
- `policy.md` Agent specific constraints (in addition to run Policy)
- `checklists.md` Pre flight, execution, output checklists, and acceptance criteria
- `prompt-map.md` Which prompts (and versions) the agent uses from `prompts/` (**TODO** when prompts exist)
- `examples.md` Example inputs/outputs that conform to `docs/agent-contract.md` (**TODO**)

The exact filenames and formats are intentionally not enforced yet.

## Relationship to the Agent Contract

All agents MUST conform to the Agent Contract:

- Canonical contract: `docs/agent-contract.md`
- Summary: `docs/agents.md`

An agent spec SHOULD state which conformance level it targets (L0/L1/L2).

## Agent index

Orchestration & Planning Agents:

- [`domain/roles/coordinator/README.md`](coordinator/README.md) Routes tasks, aggregates outputs, and produces run summaries.
- [`domain/roles/planner/README.md`](planner/README.md) Produces structured plans only; no execution or side effects.

Decision:

- [`domain/roles/decision-maker/README.md`](decision-maker/README.md) Resolves tradeoffs and conflicts and records final decisions.

Security and compliance:

- [`domain/roles/ciso/README.md`](ciso/README.md) Reviews artifacts for security, privacy, and compliance and produces a report.

Engineering:

- [`domain/roles/tech-lead/README.md`](tech-lead/README.md) Produces technical plans, risks, dependencies, and estimates.
- [`domain/roles/architect/README.md`](architect/README.md) Produces architecture proposals and ADR like decision records.
- [`domain/roles/dba/README.md`](dba/README.md) Reviews data layer changes, migrations, performance, and rollback safety.
- [`domain/roles/pr-reviewer/README.md`](pr-reviewer/README.md) Reviews PR diffs and produces a structured PR review report.

Operations:

- [`domain/roles/devops/README.md`](devops/README.md) Defines deploy, observability, scaling, reliability, and cost guidance.

Data:

- [`domain/roles/data-scientist/README.md`](data-scientist/README.md) Defines analysis plans, data requirements, metrics, and experiments.

Quality:

- [`domain/roles/qa/README.md`](qa/README.md) Defines test strategy, quality gates, and regression risk assessment.

Documentation:

- [`domain/roles/technical-writer/README.md`](technical-writer/README.md) Reviews documentation for accuracy, clarity, and consistency.

Legal and compliance:

- [`domain/roles/legal/README.md`](legal/README.md) Reviews licensing and notice requirements and produces a compliance report.
