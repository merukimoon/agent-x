# Golden Path: Planner-Only Mode v2

## Goal
This example demonstrates running the **Planner agent** in isolation using the current CLI contract. The planner reads `runs/<RUN>/inputs/` and writes planner outputs under `outputs/planner/`. Use this to validate the plumbing end to end without running additional agents.

## Prerequisites
- **Node.js**: v18 or higher.
- **Dependencies**: Run `pnpm install --frozen-lockfile` in the repo root.
- **LLM configuration**: `config/llm_models.json` defines defaults and per-agent model selection. The planner uses the `planner` entry or the defaults block. Auth resolves from the provider `auth_env` unless `LLM_API_KEY` is set. `LLM_ENDPOINT` and `LLM_MODEL` override the resolved endpoint and model for compatibility.

## Running the Planner
From the repository root:

```bash
# 1) Create a run and capture the RUN id
make run-new NAME="planner-only-v2"
# Example output: Created run: runs/2026-01-23_1234-planner-only-v2/
RUN="2026-01-23_1234-planner-only-v2"

# 2) Use the Make convenience target (writes inputs and runs planner)
make planner \
  GOAL="$(cat docs/run-examples/golden-path/planner-only-v1/sample-goal.txt)" \
  CONTEXT="$(cat docs/run-examples/golden-path/planner-only-v1/sample-context.txt)" \
  RUN="$RUN"

# OR: manually edit runs/$RUN/inputs/request.md and context.md, then run CLI directly
pnpm exec agentic plan --run "$RUN"
```

## Output Artifacts
Each run writes artifacts under `runs/<RUN>/`:

| File | Description |
|------|-------------|
| `outputs/planner/result.json` | Planner result metadata (run id, status, timestamps). |
| `outputs/planner/notes.md` | Notes capturing request/context excerpts. |
| `inputs/request.md` | Request text used for the run. |
| `inputs/context.md` | Context text used for the run. |

## Exit Codes
- **0**: Success.
- **>0**: CLI validation failed (e.g., missing RUN, missing inputs). Messages are printed to stderr.

## Troubleshooting

| Symptom | Exit Code | Action |
|---------|-----------|--------|
| Missing RUN | 2 | Set `RUN` from `make run-new NAME=...` and retry. |
| Run directory not found | 2 | Create it first with `make run-new NAME=...`. |
| Inputs/request.md empty | 0 | Fill `runs/<RUN>/inputs/request.md` before rerunning to get meaningful output. |
