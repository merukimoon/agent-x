# Architecture (high-level)

The repository is currently in documentation scaffolding and does not yet include an implemented **AgentX runtime** (**TODO**). This document describes the intended architecture so future implementation stays coherent.

## Goals

- Keep the core small and composable
- Separate “agent logic” from “orchestration/runtime”
- Make prompts, configuration, and examples easy to audit and version

## Proposed components (**TODO** confirm once code exists)

- **Core types**: Agent, Squad, Task, Message, Result
- **AgentX Runtime**: The platform layer that runs tasks, routes messages, and manages state (the "Orchestrator").
- **Tool interface**: A constrained way for agents to interact with the outside world
- **Prompt management**: Storage, versioning, and composition of prompts
- **Provider adapters**: Model/API adapters (if applicable) (**TODO**)

## Repository layout

This repository is structured so specifications and artifacts have obvious homes before any runtime code exists.

- `agents/` Agent specifications (responsibilities, policies, checklists). No implementation code.
- `prompts/` Versioned prompts used by agents.
- `schemas/` Schemas for structured inputs/outputs and contract validation (format TBD).
- `runs/` Execution run outputs and produced artifacts (usually not committed).
- `docs/` Conceptual documentation and canonical specs (including `docs/agent-contract.md`).

Example layout:

```text
.
├── agents/
│   └── README.md
├── prompts/
│   └── README.md
├── schemas/
│   └── README.md
├── runs/
│   └── README.md
├── docs/
│   ├── README.md
│   └── agent-contract.md
└── .github/
```

## Orchestration & Flows

### Orchestration philosophy

Orchestration MUST be explicit and inspectable:

- The Coordinator drives flows by routing tasks, collecting inputs, and aggregating outcomes.
- The Coordinator does not make final decisions when tradeoffs exist.
- The Decision Maker resolves conflicts, approves outcomes, and records rationale.
- The CISO performs security, privacy, and compliance review as a gating step when changes touch policies, prompts, schemas, or other sensitive areas.

All agent interactions MUST follow [`docs/agent-contract.md`](agent-contract.md). Canonical workflows are defined in [`docs/flows.md`](flows.md).

The **AgentX** platform handles the binding between abstract agents and the specific runtime execution.

### AgentX Orchestration overview


Orchestration integrates the full agent set and makes participation explicit:

- The Coordinator owns routing, sequencing, and aggregation.
- The Decision Maker is the single authority for approvals within a run.
- QA, CISO, and Legal reviews are explicit gates where applicable.
- Specialized agents are pulled in by scenario, not always on.

### Roles in flows (summary)

- Coordinator: decomposes tasks, delegates work, aggregates final outcome, emits run summary.
- Decision Maker: selects among options, resolves conflicts, accepts or rejects risk, delegates next steps.
- CISO: reviews artifacts, classifies findings (block or warning), emits a structured report.

### Scenario to agent mapping

This mapping defines the default participation model. Specific flows in `docs/flows.md` are canonical.

| Scenario | Mandatory agents | Optional agents | Decision owner |
| --- | --- | --- | --- |
| Documentation or PR completion | Coordinator, Technical Writer, QA, CISO, Legal, Decision Maker, PR Reviewer (code or config PRs) | Tech Lead (if technical changes), DevOps (if operational impact), DBA (if data impact) | Decision Maker |
| Architecture or design change | Coordinator, Architect, Tech Lead, QA, CISO, Decision Maker | DBA (data impact), DevOps (infra impact), Legal (license or dependency changes), Data Scientist (model or analytics impact), Technical Writer (doc updates) | Decision Maker |
| Performance, reliability, or cost issue | Coordinator, DevOps, DBA, QA, Decision Maker | Architect, Data Scientist, CISO (if security relevant), Tech Lead (if implementation planning needed) | Decision Maker |

### Example flow diagram

Bullet-based:

- Trigger occurs (for example, documentation updated).
- Coordinator collects artifacts and defines required checks.
- CISO reviews artifacts and emits a SecurityComplianceReport.
- Decision Maker approves, rejects, or requests changes.
- Coordinator aggregates outcomes and publishes run summary and next steps.

Sequence (ASCII):

```text
Trigger
  |
  v
Coordinator ---> CISO
    |             |
    |<--- report--|
    |
    +-----------> Decision Maker
    |               |
    |<--- decision--|
    |
    v
Coordinator (final summary)
```

### Full system view (ASCII)

This is the high level interaction shape across a run. Not all agents run in every scenario.

```text
Trigger
  |
  v
Coordinator
  |
  +--> Technical Writer (docs quality, if in scope)
  +--> Tech Lead (plan, if in scope)
  +--> Architect (design, if in scope)
  +--> DBA (data layer, if in scope)
  +--> DevOps (ops, scaling, cost, if in scope)
  +--> Data Scientist (analysis, if in scope)
  +--> QA (quality gate, if in scope)
  +--> CISO (security gate, if in scope)
  +--> Legal (license gate, if in scope)
  |
  v
Decision Maker (single approval authority)
  |
  v
Coordinator (final run summary)
```

## Data flow (typical)

1) A caller creates a Task (goal + inputs + constraints)
2) The Orchestrator selects or constructs a Squad
3) Agents exchange Messages and call Tools (if enabled)
4) The Orchestrator aggregates outputs into a Result

## Non-goals (for now)

- A full hosted service (unless explicitly added later) (**TODO**)
- A large plugin ecosystem before the core stabilizes (**TODO**)
