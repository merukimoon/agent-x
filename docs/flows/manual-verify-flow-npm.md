# Manual Verify Flow (npm)

This guide shows how to run the Verify Flow manually using npm commands only. It mirrors the automated `make verify-flow` sequence and uses the real CLI contract.

## Prerequisites
- Node.js and npm installed
- Repo dependencies installed (`npm install`)
- `.env` configured for the planner LLM (for example `LLM_API_KEY`, `LLM_ENDPOINT`, `LLM_MODEL`)

## Create a Run (npm)

The run scaffold reads the run name from the `NAME` environment variable and prints the created run directory path. Copy the run id from that path (the folder name under `runs/`).

Git Bash:
```bash
NAME="manual-verify-flow" npm run run-new
```

PowerShell:
```powershell
$env:NAME = "manual-verify-flow"
npm run run-new
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

## Manual Steps (npm)

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
npm run dev -- planner --run "$RUN"
```

PowerShell:
```powershell
npm run dev -- planner --run $RUN
```

Check outputs:
- `runs/<RUN>/outputs/planner/result.json`
- `runs/<RUN>/outputs/planner/notes.md`
- If it fails: `runs/<RUN>/outputs/planner/status.json` and `runs/<RUN>/outputs/planner/stderr.txt`

### Step 3. Run Status (informational)
Git Bash:
```bash
npm run dev -- status --run "$RUN"
```

PowerShell:
```powershell
npm run dev -- status --run $RUN
```

### Step 4. Run Coordinator (dry-run)
Coordinator creates `plan.json` used by `flow`.

Git Bash:
```bash
npm run dev -- agent coordinator --run "$RUN" --dry-run
```

PowerShell:
```powershell
npm run dev -- agent coordinator --run $RUN --dry-run
```

Check outputs:
- `runs/<RUN>/plan.json`
- `runs/<RUN>/outputs/coordinator/result.json`
- `runs/<RUN>/outputs/coordinator/notes.md`

### Step 5. Run Flow (dry-run)
Git Bash:
```bash
npm run dev -- flow --run "$RUN" --dry-run
```

PowerShell:
```powershell
npm run dev -- flow --run $RUN --dry-run
```

Check outputs:
- `runs/<RUN>/outputs/decision-maker/`
- `runs/<RUN>/outputs/pr-reviewer/`

### Step 6. Run Agents Directly (dry-run)

These validate the agent command path directly (agent name is positional, no `--agent` flag):

Git Bash:
```bash
npm run dev -- agent ciso --run "$RUN" --dry-run
npm run dev -- agent decision-maker --run "$RUN" --dry-run
npm run dev -- agent pr-reviewer --run "$RUN" --dry-run
```

PowerShell:
```powershell
npm run dev -- agent ciso --run $RUN --dry-run
npm run dev -- agent decision-maker --run $RUN --dry-run
npm run dev -- agent pr-reviewer --run $RUN --dry-run
```

## Troubleshooting

- If `npm run dev -- status --run <RUN>` exits non-zero, confirm the run directory exists and you are passing the run id (not a full path).
- If planner fails, inspect `runs/<RUN>/outputs/planner/stderr.txt` and confirm `.env` LLM configuration is valid.
- If `flow` fails, ensure coordinator ran and created `runs/<RUN>/plan.json`.
