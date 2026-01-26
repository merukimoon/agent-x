# Agents (specifications)

This directory contains domain and business agent specifications: the stable, reviewable definition of what each agent is responsible for and how it behaves. These are not external coding assistants; see the root `AGENTS.md` for external assistant guidance.

This is not where implementation code lives. Until a runtime or language is chosen, treat everything here as contract- and policy-level documentation.

## What an agent directory represents

Create one folder per agent as `domain/roles/<agent-name>/`. That folder represents a single agent identity that can participate in a run, such as `planner`, `executor`, or `reviewer`.

## Expected contents per agent (recommended)

1. `README.md` Purpose, scope, responsibilities, and non goals
2. `policy.md` Agent specific constraints in addition to run Policy
3. `checklists.md` Pre flight, execution, output checklists, and acceptance criteria
4. `prompt-map.md` Which prompts and versions the agent uses from `prompts/` (TODO when prompts exist)
5. `examples.md` Example inputs and outputs that conform to `docs/agent-contract.md` (TODO)

The exact filenames and formats are intentionally not enforced yet.

## Relationship to the Agent Contract

All agents must conform to the Agent Contract.

1. Canonical contract: `docs/agent-contract.md`
2. Summary: `docs/agents.md`

An agent spec should state which conformance level it targets (L0, L1, or L2).

## Role types

### Decision

1. [`domain/roles/decision-maker/README.md`](decision-maker/README.md) Resolves tradeoffs and conflicts and records final decisions.

### Planning

1. [`domain/roles/planner/README.md`](planner/README.md) Produces structured plans only; no execution or side effects.
2. [`domain/roles/coordinator/README.md`](coordinator/README.md) Routes tasks, aggregates outputs, and produces run summaries.
3. [`domain/roles/architect/README.md`](architect/README.md) Produces architecture proposals and ADR style decision records.
4. [`domain/roles/tech-lead/README.md`](tech-lead/README.md) Produces technical plans, risks, dependencies, and estimates.
5. [`domain/roles/dba/README.md`](dba/README.md) Reviews data layer changes, migrations, performance, and rollback safety.
6. [`domain/roles/data-scientist/README.md`](data-scientist/README.md) Defines analysis plans, data requirements, metrics, and experiments.

### Execution

1. [`domain/roles/devops/README.md`](devops/README.md) Defines deploy, observability, scaling, reliability, and cost guidance.
2. [`domain/roles/technical-writer/README.md`](technical-writer/README.md) Reviews documentation for accuracy, clarity, and consistency.

### Assurance and Governance

1. [`domain/roles/ciso/README.md`](ciso/README.md) Reviews artifacts for security, privacy, and compliance and produces a report.
2. [`domain/roles/legal/README.md`](legal/README.md) Reviews licensing and notice requirements and produces a compliance report.
3. [`domain/roles/qa/README.md`](qa/README.md) Defines test strategy, quality gates, and regression risk assessment.
4. [`domain/roles/pr-reviewer/README.md`](pr-reviewer/README.md) Reviews PR diffs and produces a structured PR review report.
