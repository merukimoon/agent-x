# Flow B Golden Path: Architecture Change Proposal

Purpose: show a complete, manual, language agnostic run for Flow B (Architecture or design change) using the run structure and Agent Contract outputs.

Use this when proposing a significant architecture change, contract update, or repository structure change that requires design review, planning, QA risk assessment, security review, and explicit approval. Optional specialists (DBA, DevOps, Data Scientist) join when data, operations, or analytics impacts exist.

## Typical triggers

- New subsystem or service design.
- Contract or schema changes that affect multiple agents or teams.
- Major refactors that change cross cutting concerns (security, observability, performance).

## Recommended run id

Format: `YYYY-MM-DD_HHMM-arch-<short-slug>`

Example: `2026-01-18_1015-arch-async-messaging`

## Run folder layout (tree)

```
runs/<run-id>/
├── README.md
├── run.json
├── inputs/
│   ├── request.md
│   └── context.md
├── outputs/
│   ├── coordinator/
│   │   ├── result.json
│   │   └── notes.md
│   ├── architect/
│   │   ├── result.json
│   │   └── notes.md
│   ├── tech-lead/
│   │   ├── result.json
│   │   └── notes.md
│   ├── qa/
│   │   ├── result.json
│   │   └── notes.md
│   ├── ciso/
│   │   ├── result.json
│   │   └── notes.md
│   ├── decision-maker/
│   │   ├── result.json
│   │   └── notes.md
│   ├── dba/
│   │   ├── result.json
│   │   └── notes.md
│   ├── devops/
│   │   ├── result.json
│   │   └── notes.md
│   └── data-scientist/
│       ├── result.json
│       └── notes.md
├── artifacts/
│   └── .gitkeep
└── summary/
    └── final.md
```

## Execution order (Flow B)

1) Coordinator (ingest request and route)
2) Architect (propose architecture options)
3) Tech Lead (plan, sequencing, risks)
4) Optional specialists (DBA, DevOps, Data Scientist) if impacts exist
5) QA (quality and regression plan)
6) CISO (security and privacy review)
7) Decision Maker (approve, reject, or request changes)
8) Coordinator (final aggregation and run summary)

Mandatory agents: Coordinator, Architect, Tech Lead, QA, CISO, Decision Maker.  
Optional agents: DBA (data impact), DevOps (infra impact), Data Scientist (analytics impact), Legal (add only if licensing changes exist).

## Decision points and escalation

- Decision Maker is the sole approver. Blocking items must be resolved or explicitly accepted.
- Coordinator escalates when scope changes, optional agents are needed, or inputs are insufficient.
- QA, CISO, and any specialist flags blocking or warning findings; blocking items escalate to Decision Maker.
- Legal is pulled in only when licensing or third party terms change; otherwise omit.

## Capturing and tracing decisions

- Architect and Tech Lead record options, rationale, and tradeoffs in their `result.json` and notes.
- QA classifies quality risks as blocking or non blocking; CISO classifies security findings as blocking or warning.
- Decision Maker records the selected option, accepted risks, and mandated follow-ups.
- Coordinator aggregates all findings and links artifacts in `summary/final.md` and `run.json` status.

## Example content

See `docs/run-examples/architecture-change/templates/` for filled templates ready to copy into a new run.

Highlights:

- `inputs/request.md` captures the architecture proposal, constraints, and success criteria.
- `inputs/context.md` captures current architecture, ADR references, and constraints.
- Each agent output aligns to the Agent Contract and includes decisions, risks, and next steps.
- Optional agents are included in the tree; remove them in a real run if not needed.
- `summary/final.md` shows how the Coordinator aggregates the approved decision, tradeoffs, and follow-ups.

## Manual run checklist

- [ ] Create run: `make run-new NAME="arch-<slug>"`
- [ ] Fill `inputs/request.md` and `inputs/context.md`
- [ ] Copy templates from `docs/run-examples/architecture-change/templates/` into the run and adapt
- [ ] Have each required agent fill `outputs/<agent>/result.json` and `notes.md`
- [ ] Include optional agents (DBA, DevOps, Data Scientist, Legal if needed) when impacts are present
- [ ] Store artifacts under `artifacts/` and reference them from agent results
- [ ] Decision Maker records the selected option and accepted risks
- [ ] Coordinator writes `summary/final.md` and updates `run.json` status
