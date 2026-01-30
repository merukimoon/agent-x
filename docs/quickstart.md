# Quickstart

## Purpose
- Provide one straightforward way to run AgenticX locally and see a successful flow.

## Prerequisites
- Node.js v18+ installed.
- Dependencies installed: `pnpm install --frozen-lockfile` in repo root.

- Optional: `.env` configured if using an LLM-backed planner.

## Quick Start (Commands)
```bash
# From repo root
RUN=$(pnpm exec agentic run new --goal "Sample verification" --context "Local quickstart" --print-run)
pnpm exec agentic plan --run "$RUN" --dry-run
pnpm exec agentic agent coordinator --run "$RUN" --dry-run
pnpm exec agentic flow --run "$RUN" --dry-run
pnpm exec agentic status --run "$RUN"
pnpm exec agentic verify-run --run "$RUN"
```

ADX is the CLI interface of AgentX, used by developers to run, plan, and verify AI-driven workflows via a deterministic API.

Make targets are provided for contributor convenience only; user-facing workflows should use ADX (the `agentic` CLI).

## What Happens During a Run
- `agentic run new` scaffolds a run folder with inputs.
- `agentic plan` runs the planner command path and writes planner outputs under `outputs/planner/`.
- `agentic agent coordinator` classifies inputs and writes `plan.json`.
- `agentic flow` executes the dry-run flow and writes step outputs.
- `agentic verify-run` validates run artifacts (read-only; fails on missing/invalid artifacts).
- Runs are written under `runs/<RUN_ID>/` with inputs, outputs, steps, and summary.

## Outputs and Where to Find Them
- Runs: `runs/<RUN_ID>/` contains `run.json`, `plan.json`, inputs, outputs per agent, steps, and `summary/final.md`.
- Verification logs: console output from the make commands; run folders remain for inspection.

## What “Success” Looks Like
- Commands exit 0.
- Run folders include `run.json` with `status: done`, `exit_code: 0`, and `summary/final.md` plus per-agent outputs.
- Orchestrator validation prints `RUN_ID=...` and `verify-run OK`.

## Common Failures (Pointers Only)
- Missing required artifacts or invalid statuses: see `docs/contracts/run_artifacts.md` and `docs/contracts/run_lifecycle.md`.
- Agent output issues or forbidden behaviors: see `docs/contracts/agent_contract.md` and `docs/contracts/agent_failure_protocol.md`.
- Soft vs hard rule handling: see `docs/contracts/rules_model.md`.
- Verification pipeline expectations: see `docs/contracts/verification_contract.md`.

## Next Reading (Links to Contracts)
- Golden Path v0: `docs/golden-path-v0.md`
- Run lifecycle: `docs/contracts/run_lifecycle.md`
- Run artifacts: `docs/contracts/run_artifacts.md`
- Agent contract: `docs/contracts/agent_contract.md`
- Failure protocol: `docs/contracts/agent_failure_protocol.md`
- Rules model: `docs/contracts/rules_model.md`
- Verification contract: `docs/contracts/verification_contract.md`

## Non-Goals
- No troubleshooting beyond pointers.
- No alternative run modes or CI guidance.
