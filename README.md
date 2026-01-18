# Agentic Squad Framework

Framework for building and running small “squads” of cooperating agents to complete engineering tasks.

This repository is currently in early scaffolding. Where details are not yet implemented or confirmed, this documentation uses **TODO** markers.

## Who this is for

- Engineers who want to build agent-based workflows (single agent or multi-agent).
- Contributors who want to help define the framework’s API, runtime, and best practices.

## Core concepts (intended)

These terms describe the intended shape of the project; adjust as the codebase evolves (**TODO**).

- **Agent**: A unit of behavior with instructions, context, and access to tools.
- **Squad**: A collection of agents coordinated to complete a task.
- **Task**: A bounded unit of work with inputs, constraints, and expected outputs.
- **Orchestrator/Runner**: The component that schedules tasks, routes messages, and manages state.
- **Prompt**: Versioned instructions/templates used by agents.

More detail: `docs/concepts.md`.

## Quick start

This repo does not yet publish an installable package (**TODO**). For now:

1) Clone the repo
2) Read the docs index: `docs/README.md`
3) If you’re contributing, follow: `CONTRIBUTING.md`

## Running an agent dry run

1) Create a run folder: `make run-new NAME="demo-task"`
2) Fill `runs/<RUN_ID>/inputs/request.md` and `runs/<RUN_ID>/inputs/context.md`.
3) Execute a dry run for an agent: `make agent RUN="<RUN_ID>" AGENT="coordinator" DRY=1`
4) Check outputs under `runs/<RUN_ID>/outputs/<agent>/` (`notes.md` and `result.json`).

## Coordinator plan and flow execution

- Run the coordinator to produce `plan.json`: `node scripts/agentic.mjs agent coordinator --run "<RUN_ID>" --dry-run`
- Execute the plan-driven flow: `node scripts/agentic.mjs flow --run "<RUN_ID>" --dry-run`
- Makefile helper: `make flow RUN="<RUN_ID>" DRY=1` (omit `DRY=1` to run without the dry-run flag; current Step 2 behavior is the same).
- Validate a run: `node scripts/agentic.mjs validate --run "<RUN_ID>"`
- Retry or skip a step: `node scripts/agentic.mjs retry --run "<RUN_ID>" --step "<STEP_ID>"` or `... skip ...`
- View plan status: `make run-status RUN="<RUN_ID>"` (or `node scripts/agentic.mjs status --run "<RUN_ID>"`)

## Coordinator planning logic (rules-based)

- The coordinator classifies inputs into flows without LLMs.
- Supported flows:
  - PR Completion: decision-maker -> pr-reviewer (+ ciso if security keywords appear).
  - Architecture Change: decision-maker -> pr-reviewer -> ciso.
- Classification relies on keywords in `inputs/request.md` and `inputs/context.md` and records `flow_type` plus a short rationale in `plan.json`.
- Explainability: plan records matched keyword signals and a confidence level (high/medium/low). Status output shows flow, confidence, and signals (capped preview).

## Reliability notes (Step 3)

- Writes to plan and agent outputs are atomic (temp + rename) to avoid partial files.
- Flow execution uses a lock file (`runs/<RUN_ID>/.lock`); if present, flow refuses to start. Delete only if confirmed stale.
- Validation exit codes: 10 (plan missing/invalid JSON), 11 (missing files referenced by plan or inputs), 12 (schema/invariant violations). Errors are printed with `ERROR:` prefixes.
- Step state machine: pending→running→(done|failed); pending→skipped; failed→pending (retry); failed→skipped. Other transitions are rejected.
- Retry: allowed only from failed, increments attempt, clears `last_error`, sets status to pending.
- Skip: allowed only from pending or failed when `allow_skip` is true; keeps attempt and `last_error`, sets status to skipped.
- Windows note: fsync may be rejected on some file systems; atomic writes are best-effort and fall back to temp+rename when fsync is not permitted.
- Status dashboard example:
  ```
  Run: 2026-01-18_1315-flow-step3-prod
  Plan: version=0.1 created_at_utc=2026-01-18T12:26:31Z
  Counts: pending=1 running=0 done=2 failed=0 skipped=0
  LOCK: none
  Steps:
  id             agent             status     attempt      depends_on
  step-1         decision-maker    done       0/1          coordinator
  step-2         pr-reviewer       pending    1/2          decision-maker
  NEXT: step step-2 is ready
  ```

## Type checking for JS

- The runtime stays in `.mjs` (ESM) and runs with Node directly—no build step.
- Static typing is provided by TypeScript in `checkJs` mode with `// @ts-check` and JSDoc typedefs.
- Run `npm install` once, then `npm run typecheck` to validate the CLI.

## Minimal usage example (pseudo-code)

```text
agentA = Agent(name="planner", prompt="...")           # TODO: actual API
agentB = Agent(name="executor", prompt="...")          # TODO: actual API

squad = Squad(agents=[agentA, agentB])                 # TODO: actual API
result = squad.run(task="Add a README and templates")  # TODO: actual API

print(result.output)
```

## Repository structure

- `.github/` GitHub issue/PR templates and workflows
- `agents/` Agent specifications (no implementation code)
- `docs/` User and contributor documentation
- `prompts/` Versioned prompts used by agents
- `schemas/` Schemas for structured inputs/outputs and contracts
- `runs/` Execution outputs and produced artifacts (usually not committed)
- `LICENSE` Project license (MIT)

## Documentation

- Getting oriented: [`docs/README.md`](docs/README.md)
- Architecture overview: [`docs/architecture.md`](docs/architecture.md)
- Orchestration flows: [`docs/flows.md`](docs/flows.md)
- Concepts and terms: [`docs/concepts.md`](docs/concepts.md)
- Agent Contract (canonical): [`docs/agent-contract.md`](docs/agent-contract.md)
- Agent roles and interfaces: [`docs/agents.md`](docs/agents.md)
- Prompting guidance: [`docs/prompting.md`](docs/prompting.md)
- Examples: [`docs/examples.md`](docs/examples.md)
- Versioning policy: [`docs/versioning.md`](docs/versioning.md)
- Roadmap: [`docs/roadmap.md`](docs/roadmap.md)

## White Paper

See the canonical white paper for the framework’s conceptual model, roles, terminology, and verification approach: [`docs/white-papers/agentic-squad-framework.md`](docs/white-papers/agentic-squad-framework.md).

## Contributing

See `CONTRIBUTING.md` for setup, workflow, and PR expectations.

## Security

See `SECURITY.md` for vulnerability reporting.
