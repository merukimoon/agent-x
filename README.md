# Agentic Squad Framework

Framework for building and running small “squads” of cooperating agents to complete engineering tasks.

This is not a library. This is a framework that defines how agentic systems are structured, governed, and executed.

> **Note**: This repository is structured as a monorepo-ready project (using `packages/` layout) but currently operates as a single package.

This repository is currently in early scaffolding. Where details are not yet implemented or confirmed, this documentation uses **TODO** markers.

## Who this is for

- Engineers who want to build agent-based workflows (single agent or multi-agent).
- Contributors who want to help define the framework’s API, runtime, and best practices.

## Packages Overview

The repository is organized into the following packages (Monorepo-ready):

| Package | Description |
| :--- | :--- |
| `packages/core` | **Fundamentals**. Contains the core types, contracts, schemas, and shared utilities defining the "Agentic Squad" protocol. |
| `packages/cli` | **Command Line Interface**. The `agentic` CLI implementation. Orchestrates agents, manages plans, and handles user interactions. |
| `packages/adapters` | **Adapters** (Future). Connectors for external tools and platforms. |
| `scripts/agentic` | **Legacy/Entrypoint**. Contains the `agentic.ts` entrypoint (which delegates to the CLI package) and legacy implementation logic being migrated. |

> **Note**: While structured as packages, this is currently a **single-root project**. We use relative imports to link packages without heavyweight workspace tooling.

## Core concepts (intended)

These terms describe the intended shape of the project; adjust as the codebase evolves (**TODO**).

- **Agent**: A unit of behavior with instructions, context, and access to tools.
- **Squad**: A collection of agents coordinated to complete a task.
- **Task**: A bounded unit of work with inputs, constraints, and expected outputs.

- **AgentX Runtime**: The conceptual platform execution engine that schedules tasks, routes messages, and manages state (formerly "Orchestrator").
- **Prompt**: Versioned instructions/templates used by agents.

## AgentX Platform

**AgentX** is the conceptual execution platform that defines how agentic systems operate within the framework. While **Agentic Squad Framework** names the overall project and repository, **AgentX** describes the runtime and execution model.

It encompasses:
- **AgentX Runtime**: The deterministic engine that drives flows and typically serves as the "Coordinator".
- **AgentX Verification Model**: The fail-closed safety system ensuring policy compliance (Exit 12).
- **AgentX Gates**: Explicit checkpoints for **human-in-the-loop** approval and **policy gates**.
- **AgentX Execution Semantics**: The rules encoding deterministic execution, atomic artifact generation, and explicit overrides.

AgentX is the layer that makes the "Squad" behave reliably, ensuring no "ghost actions" occur outside the plan.

## Platform support

The framework is developed on Windows (using WSL or Git Bash) and Linux.

- **Make**: On Windows, you must use **Git Bash** or **WSL** to run `make` targets. PowerShell is not supported for Make commands due to shell syntax differences (`set -eu`, etc.).
- **Node.js**: The runtime scripts (`npm run dev`) work natively in PowerShell, cmd.exe, and bash.

More detail: `docs/concepts.md`.

## ESM defaults

- Classification relies on keywords in `inputs/request.md` and `inputs/context.md` and records `flow_type` plus a short rationale in `plan.json`.
- Explainability: plan records matched keyword signals and a confidence level (high/medium/low). Status output shows flow, confidence, and signals (capped preview).
- Flow selection: evaluates rule packs, picks the flow with the most keyword matches (ties favor architecture-change when applicable).
- Rule pack shape (example): `{"flow_type":"pr-completion","keywords":["pull request",...],"steps":[{"id":"step-1","agent":"decision-maker","depends_on":["coordinator"]},...]}`.

## Planner (LLM-based agent)

The Planner agent connects to an LLM to generate a plan based on a Goal and Context. It is a regular agent: it produces plans only and performs no execution.

### Setup

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Edit `.env` and set your `LLM_API_KEY` (e.g., OpenAI key).

### Usage

Create a run and capture the RUN id:

```bash
make run-new NAME="planner-demo"
# Example output: Created run: runs/2026-01-23_1234-planner-demo/
RUN="2026-01-23_1234-planner-demo"
```

Run the planner with convenience Make target (writes inputs/request.md and inputs/context.md for you):

```bash
make planner GOAL="Create a new feature" CONTEXT="Repo uses /src for code" RUN="$RUN"
```

Or manually via CLI after editing `runs/$RUN/inputs/request.md` and `runs/$RUN/inputs/context.md`:

```bash
npm run dev -- planner --run "$RUN"
```

The planner outputs:
- `runs/<RUN>/outputs/planner/result.json`
- `runs/<RUN>/outputs/planner/notes.md`
- `runs/<RUN>/outputs/planner/status.json`

Run lifecycle (canonical):
- `run.json` is the source of truth for run state. Created with `status: in_progress` and later set to `done` or `failed`.
- Required fields on completion: `status`, `flow`, `started_at_utc`, `finished_at_utc`, `exit_code`, `error` (null on success).
- Status/summary/verification commands are read-only; they do not mutate `run.json`.

#### Configuration (Multi-Model Strategy)

The Planner is built to be **cheap by default**.
- **Default Model**: `gpt-4-turbo-preview` (balanced).
- **Strategy**: Use lower-cost models for routine planning. Override with high-reasoning models ONLY if validation fails (Exit 11/12).

**To override the model**:
1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Edit `.env` to set `LLM_API_KEY` (Required) and optionally `LLM_MODEL`.
   ```bash
   # Efficient Default
   LLM_MODEL=gpt-4-turbo-preview
   # Reasoning/Fallback (for complex tasks)
   LLM_MODEL=gpt-4o
   ```
3. Run the planner (credentials loaded automatically):
   ```bash
   # Manual Goal (requires RUN from make run-new)
   make planner GOAL="Refactor the login page" CONTEXT="Repo uses /src for code" RUN="$RUN"
   
   # Verification Demo
   make planner-demo RUN="$RUN"
   ```
**Security Note**: Never commit `.env` to git. It is ignored by default.

#### Reliability & Contract

See strictly defined docs:
- [Planner Contract](docs/planner-contract.md) (Normative rules)
- [Retry Policy](docs/planner-retry-policy.md) (Handling exit codes 0/10/11/12)

- **No Execution**: The planner only produces artifacts. It NEVER executes the plan.
- **Exit Codes**:
  - `0`: Success (valid plan).
  - `10`: Network/Internal error (retryable).
  - `11`: Schema/Parse error (prompt refinement needed).
  - `12`: Safety/Policy violation (gate failure).
- **Cleanup**: Outer markdown fences (```json) are strictly stripped before parsing. If parsing fails, raw output is saved to `planner_failed_raw.txt`.

### Golden Path Example

For a complete, runnable example of a single-agent run using the Planner, see:
[Golden Path: Planner-Only v2](examples/golden-path/planner-only-v1/README.md)


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

- The runtime stays in `.js` (ESM) and runs with Node directly—no build step.
- Static typing is provided by TypeScript in `checkJs` mode with `// @ts-check` and JSDoc typedefs.
- Run `npm install` once, then `npm run typecheck` to validate the CLI.
- Quick verification: `make verify-fast` (typecheck + verify-esm; no tests).
- Full verification: `make verify` (verify-fast + tests).
- Product wiring verification: `make verify-flow` (creates a run, planner, status, agent dry-run, flow dry-run).
- Run artifacts contract check: `make validate-run RUN=<RUN>` (alias: `make verify-run RUN=<RUN>` or `npm run verify-run -- --run <RUN>`).
- Orchestrator validation: `make orchestrator-validate GOAL="..." [MODE=planner|planner-architect]` (runs orchestrator flow then verify-run; default mode is planner-architect).

## Make targets

Run validation  
* make validate-run RUN=<run-id>  
* make verify-run RUN=<run-id> (alias)

Execution flows  
* make verify-flow  
* make orchestrator-validate GOAL="..." [MODE=planner|planner-architect]

Definitions live in Make/verify.mk for verification targets and Make/execute.mk for execution flows.

## How to resolve a gated run

1) Detect a gated run  
   - Check status: `make run-status RUN="<run-id>"`  
   - If the output shows `State: BLOCKED`, note the blocked `step_id` (and agent).

2) Inspect the step artifacts  
   - `runs/<run-id>/steps/<step-id>/human_prompt.md` tells you what is needed.  
   - `decision_after_step.json` is the base decision.  
   - `effective_decision.json` is the applied decision (after any override).  
   - If `required_inputs` is present, gather or produce those inputs.

3) Create an override (only when action is `require_human` or `request_clarification`)  
   - Path: `runs/<run-id>/steps/<step-id>/override.json`  
   - Minimal StepOverride v1 example:
   ```json
   {
     "schema_version": "step-override.v1",
     "run_id": "<run-id>",
     "step_id": "<step-id>",
     "actor": { "type": "human", "id": "operator@example.com" },
     "override_action": "continue",
     "routing_override": { "next_agent": null, "next_model": null },
     "acknowledged_risks": ["Reviewed human prompt and approved"]
   }
   ```

4) Apply and re-check  
   - Rerun the relevant flow or command so the override is applied.  
   - Re-check status with `make run-status RUN="<run-id>"` to confirm the run is unblocked.

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
- `domain/roles/` Domain/business agent specifications (no implementation code)
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
