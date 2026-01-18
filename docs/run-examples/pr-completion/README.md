# Flow A Golden Path: PR Completion Run Example

Purpose: show a complete, manual, language agnostic run for Flow A (Documentation or PR completion) using the run structure and Agent Contract outputs.

Use this when a PR changes code or configuration and requires the full set of gates: PR Review, Technical Writer, QA, CISO, Legal, Decision Maker, and Coordinator. Tech Lead and DevOps are optional if technical or operational impacts exist.

## Recommended run id

Format: `YYYY-MM-DD_HHMM-pr-<short-slug>`

Example: `2026-01-17_1200-pr-docs-and-config`

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
│   ├── decision-maker/
│   │   ├── result.json
│   │   └── notes.md
│   ├── technical-writer/
│   │   ├── result.json
│   │   └── notes.md
│   ├── qa/
│   │   ├── result.json
│   │   └── notes.md
│   ├── pr-reviewer/
│   │   ├── result.json
│   │   └── notes.md
│   ├── ciso/
│   │   ├── result.json
│   │   └── notes.md
│   └── legal/
│       ├── result.json
│       └── notes.md
├── artifacts/
│   └── .gitkeep
└── summary/
    └── final.md
```

## Example content

See `docs/run-examples/pr-completion/templates/` for filled templates ready to copy into a new run.

Highlights:

- `inputs/request.md` captures TaskRequest: goal, acceptance criteria, constraints.
- `inputs/context.md` captures PR link, diff summary, and references.
- Each mandatory agent has `result.json` aligned to the Agent Contract plus a brief `notes.md`.
- Optional agents (Tech Lead, DevOps) can be added under `outputs/tech-lead/` and `outputs/devops/` when needed.
- `summary/final.md` shows how the Coordinator aggregates outcomes.

## Findings classification

- QA: blocking vs non blocking quality issues.
- CISO: blocking vs warning security and compliance findings.
- Legal: blocking vs warning license and notice findings.
- PR Reviewer: blocking vs non blocking review findings; dependency concerns trigger CISO or Legal review.
- Blocking findings must be resolved or explicitly accepted by the Decision Maker; acceptance is recorded in `outputs/decision-maker/result.json`.

## Manual run checklist

- [ ] Create run: `make run-new NAME="pr-<slug>"`
- [ ] Fill `inputs/request.md` and `inputs/context.md`
- [ ] Copy the templates from `docs/run-examples/pr-completion/templates/` into the run and adapt
- [ ] Have each agent fill `outputs/<agent>/result.json` and `notes.md`
- [ ] Store any produced artifacts in `artifacts/` and reference them from `result.json`
- [ ] Decision Maker records approval or change requests
- [ ] Coordinator writes `summary/final.md` and updates `run.json` status
