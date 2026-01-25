# Status

## Purpose
- Explain how run status is derived from artifacts and how to view it.

## Status Sources
- `run.json` for overall run status and exit code.
- `steps/index.json` and per-step decision files for step status and blockers.
- `outputs/<agent>/` and `steps/<step-id>/` artifacts for context only (read-only).

## Overall States
- `finished_success`: `status=done` and `exit_code=0` in `run.json`.
- `finished_failure`: `status=failed` or non-zero `exit_code`.
- `in_progress`: status `running`/`pending`.
- `invalid`: missing or unreadable core files (e.g., `run.json`).
- `incomplete`: none of the above and artifacts are partial.

## Per-Step States
- Read from `steps/index.json` (`pending`, `running`, `done`, `failed`, `skipped`, `blocked`).
- Blocked detection uses decision files (`decision_after_step.json`, `effective_decision.json`) when present.

## CLI Usage
- Show status for a run:  
  `npm run dev -- status --run <RUN_ID>`
- If `--run` is omitted, the latest run directory is used.
- Command exits non-zero only when the run directory is missing/unreadable.

## Non-Goals
- No mutation of artifacts.
- No retries or remediation.
- No forecasting of future states.
