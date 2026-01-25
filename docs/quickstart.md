# Quickstart

## Purpose
- Provide one straightforward way to run AgenticX locally and see a successful flow.

## Prerequisites
- Node.js v18+ installed.
- Dependencies installed: `pnpm install --frozen-lockfile` in repo root.

- Optional: `.env` configured if using LLM-backed planner; Golden Path v0 uses 
built-in flows.

## Quick Start (Commands)
```bash
# From repo root
make verify
make verify-plan-e2e GOAL="Sample verification" CONTEXT="Local quickstart"
```

Make targets are provided for contributor convenience; the supported interfaces remain the CLI commands (`pnpm run dev ...`) and verifiers (`pnpm run verify-run ...`).

## What Happens During a Run
- `make verify` runs typecheck, ESM checks, and tests.
- `make verify-plan-e2e` creates a new run, executes planner-only flow, runs verification gates, and exercises `verify-flow` plus orchestrator validation.
- Runs are written under `runs/<timestamp>-.../` with inputs, outputs, steps, and summary.

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
