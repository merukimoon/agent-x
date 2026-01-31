# Manual Verify Flow (pnpm)

This guide shows how to run the Verify Flow manually using pnpm commands only. (The filename is retained from the earlier npm guide.) It mirrors the automated `make verify-flow` sequence and uses the real CLI contract.

## Prerequisites
- Node.js and pnpm installed (Corepack preferred)
- Repo dependencies installed (`pnpm install`)
- `.env` configured for the planner LLM (for example `LLM_API_KEY`, `LLM_ENDPOINT`, `LLM_MODEL`)

## Create a Run (pnpm)

The run scaffold reads the run name from the `NAME` environment variable and prints the created run directory path. Copy the run id from that path (the folder name under `runs/`).

Git Bash:
```bash
NAME="manual-verify-flow" pnpm exec agentic run new
```

PowerShell:
```powershell
$env:NAME = "manual-verify-flow"
pnpm exec agentic run new
```

Set `RUN` in your shell for the remaining steps:

Git Bash:
```bash
RUN="2026-01-23_1234-manual-verify-flow"
```

PowerShell:
```powershell
$RUN = "2026-01-23_1234-manual-verify-flow"
```

## Manual Steps (pnpm)

Important CLI contract notes:
- `status` is `status --run <RUN>`
- `agent` requires a positional agent name: `agent <name> --run <RUN>`
- Do not use `--agent <name>` (unsupported)

### Step 1. Write inputs
Edit these files and ensure they are non-empty:
- `runs/<RUN>/inputs/request.md`
- `runs/<RUN>/inputs/context.md`

### Step 2. Run Planner
Git Bash:
```bash
pnpm exec agentic plan --run "$RUN"
```

PowerShell:
```powershell
pnpm exec agentic plan --run $RUN
```

Check outputs:
- `runs/<RUN>/outputs/planner/result.json`
- `runs/<RUN>/outputs/planner/notes.md`
- If it fails: `runs/<RUN>/outputs/planner/status.json` and `runs/<RUN>/outputs/planner/stderr.txt`

### Step 3. Run Status (informational)
Git Bash:
```bash
pnpm exec agentic status --run "$RUN"
```

PowerShell:
```powershell
pnpm exec agentic status --run $RUN
```

### Step 4. Run Coordinator (dry-run)
Coordinator creates `plan.json` used by `flow`.

Git Bash:
```bash
pnpm exec agentic agent coordinator --run "$RUN" --dry-run
```

PowerShell:
```powershell
pnpm exec agentic agent coordinator --run $RUN --dry-run
```

Check outputs:
- `runs/<RUN>/plan.json`
- `runs/<RUN>/outputs/coordinator/result.json`
- `runs/<RUN>/outputs/coordinator/notes.md`

### Step 5. Run Flow (dry-run)
Git Bash:
```bash
pnpm exec agentic flow --run "$RUN" --dry-run
```

PowerShell:
```powershell
pnpm exec agentic flow --run $RUN --dry-run
```

Check outputs:
- `runs/<RUN>/outputs/decision-maker/`
- `runs/<RUN>/outputs/pr-reviewer/`

### Step 6. Verify run artifacts

Run the artifact contract verifier (read-only, exits non-zero on mismatch):

Git Bash:
```bash
pnpm exec agentic verify-run --run "$RUN"
```

PowerShell:
```powershell
pnpm exec agentic verify-run --run $RUN
```

### Step 7. Run Agents Directly (dry-run)

These validate the agent command path directly (agent name is positional, no `--agent` flag):

Git Bash:
```bash
pnpm exec agentic agent ciso --run "$RUN" --dry-run
pnpm exec agentic agent decision-maker --run "$RUN" --dry-run
pnpm exec agentic agent pr-reviewer --run "$RUN" --dry-run
```

PowerShell:
```powershell
pnpm exec agentic agent ciso --run $RUN --dry-run
pnpm exec agentic agent decision-maker --run $RUN --dry-run
pnpm exec agentic agent pr-reviewer --run $RUN --dry-run
```

## Troubleshooting

- If `pnpm exec agentic status --run <RUN>` exits non-zero, confirm the run directory exists and you are passing the run id (not a full path).
- If planner fails, inspect `runs/<RUN>/outputs/planner/stderr.txt` and confirm `.env` LLM configuration is valid.
- If `flow` fails, ensure coordinator ran and created `runs/<RUN>/plan.json`.
- If `pnpm exec agentic verify-run --run <RUN>` fails, inspect the listed missing/invalid artifacts and fix them; verify-run is read-only and will not repair the run.
