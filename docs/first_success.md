# First Success Path

## 1) Who This Is For (and Who It Is Not)
- For external engineers evaluating or adopting AgenticX who want one correct run.
- Not for production customization, contract changes, or model experimentation.
- Assumes reader is a user/operator, not a maintainer changing core contracts.

## 2) Preconditions
- Tools: `node` (>=18), `npm`, `make`, `git`, and a POSIX shell.
- Knowledge: can run make/npm commands, read markdown, inspect files.
- Repo is cloned locally and dependencies are installed via `npm install`.
- No API keys required for this path; it uses bundled flows and fixtures.

## 3) First Success Path
- Scenario: run the canonical verification flow that generates a run directory and validates artifacts.
- Commands (run from repo root):
  1. `make verify` — proves type, ESM, and test suite are passing.
  2. `make verify-flow` — generates a dry-run flow under `runs/<RUN_ID>` and validates it.
- Expected outputs:
  - `make verify` exits 0.
  - `make verify-flow` prints a `RUN=` line and lists run contents.
  - A new directory under `runs/` containing `run.json`, `plan.json`, `summary/final.md`, `steps/index.json`, per-step folders, and `outputs/<agent>/result.json` and `notes.md`.
- Expected failures and interpretation:
  - Missing tools/deps → install prerequisites (`node`, `npm`, `make`) and rerun.
  - Validation errors listing missing artifacts → inspect the mentioned file paths; a valid run must contain them.
  - Non-zero exits from any command mean the first success path is not achieved; fix the reported cause before retrying.

## 4) How to Know It Worked
- All commands above exit with status 0.
- `node --import tsx scripts/agentic.ts status --run <RUN_ID>` shows `Overall: FINISHED_SUCCESS` or `IN_PROGRESS` with `Artifacts: VALID` for the generated run.
- `npm run verify-run -- --run <RUN_ID>` (or `make validate-run RUN=<RUN_ID>`) exits 0 for the same run.
- Required artifacts exist in the run directory and match the contracts.

## 5) Where to Stop
- Stop after `make verify` and `make verify-flow` complete and the run validates.
- Do not edit contracts, add agents, or change flows until the first success path is repeatable.

## 6) Common Early Mistakes
- Running commands outside the repo root (status/verify-run cannot find `runs/`).
- Deleting run artifacts before running status/verify-run.
- Assuming soft-rule annotations are optional; they belong in `outputs/<agent>/notes.md` when a soft rule is violated.
- Expecting undocumented scripts to be stable; only the commands listed here are supported for first success.

## 7) Next Steps (Optional)
- If first success is stable, read:
  - `docs/quickstart.md` for broader DX context.
  - `docs/agent_extensibility.md` before adding agents.
  - `docs/contracts/*` for the exact contracts and enforcement.
  - `docs/release_hygiene.md` for stability and release expectations.
