# ADX CLI Contract (Beta)

ADX is the CLI interface of AgentX, used by developers to run, plan, and verify AI-driven workflows via a deterministic API.

The `agentic` binary is the external, stable interface for interacting with AgentX via ADX. Make targets remain developer convenience only.

## Philosophy

- ADX is the public surface; contracts are enforced through run artifacts and verification.
- Commands are deterministic and step-centric; plans remain DAGs.
- JSON output is the stable interface; human output is informational.
- Exit codes reflect contract status and must not be ignored.

## Global Flags

- `--help`, `-h` show help
- `--version`, `-v` print CLI version
- `--json` emit machine-readable output when supported
- `--quiet` reduce human-readable output (JSON unaffected)

## Exit Codes

- `0` success
- `1` user error (bad args, unknown step, missing files)
- `2` validation failure (contract or verify-run failure)
- `3` execution failure (runner or step failed)
- `4` environment failure (missing tools or env vars)

## Commands

### Runs
- `agentic run new --goal <TEXT> --context <PATH|TEXT> [--run <RUN>] [--print-run] [--json]`
  - Scaffolds a run folder with inputs and run.json.
  - `--print-run` prints only the run id (unless `--json` is set).
  - Exit codes: 0 success, 1 user error.
- `agentic run show --run <RUN> [--json]`
  - Prints paths and metadata for the run.

### Planning
- `agentic plan --run <RUN> [--dry-run] [--json]`
  - Executes planner for the run using existing planner path.
  - Fails fast if required planner env is missing.

### Execution (primary)
- `agentic run --run <RUN> [--dry-run] [--json]`
- `agentic run --run <RUN> --step <STEP_ID> [--dry-run] [--json]`
- `agentic run --run <RUN> --from <STEP_ID> [--dry-run] [--json]`
- `agentic run --run <RUN> --until <STEP_ID> [--dry-run] [--json]`
  - Only one of `--step/--from/--until` is allowed.
  - Unknown step id exits 1.
  - Execution respects DAG order; plan schema is unchanged.
  - After non-dry runs, validation (`verify-run`) is executed; failures exit 2.

### Status and Observability
- `agentic status --run <RUN> [--json]`
  - Normalized summary of run state.
- `agentic step show --run <RUN> --step <STEP_ID> [--json]`
  - Displays step metadata, deps, and artifact paths.

### Verification
- `agentic validate --run <RUN> [--json]`
  - Validates run artifacts and plan contracts; failures exit 2.
- `agentic verify --run <RUN> [--json]`
  - Composite: validate + verify-run; failures exit 2.
- `agentic verify-run --run <RUN> [--json]`
  - Strict run artifact checker (backward compatible).

### Operations
- `agentic step retry --run <RUN> --step <STEP_ID> [--dry-run]`
- `agentic step skip --run <RUN> --step <STEP_ID> --reason <CODE> [--mode <...>]`
  - Uses existing policy and skip semantics; invalid skips exit 2.

### Environment
- `agentic doctor [--json]`
  - Checks Node and pnpm presence; exits 0/4 accordingly.

## JSON Output (stable fields)

- Runs and execution: `{ "run": "<id>", "scope": "full|single|from|until", "step": "<id|null>", "dryRun": bool, "validated": bool }`
- Status: status view object from `status_view` (run id, overall, steps).
- Step show: `{ id, agent, status, depends_on, outputs, artifacts_dir }`
- Run show: `{ run, path, plan, runJson, summary, outputs }`
- Doctor: `{ ok: bool, results: [{ check, ok, value? }] }`
- run new: `{ run, path, goal, context }`

## Compatibility Aliases

- `agentic flow` → `agentic run`
- `agentic agent <name>` (legacy direct agent invocation)
- `agentic retry` → `agentic step retry`
- `agentic skip` → `agentic step skip`

Aliases remain during beta; deprecation will be announced with a migration window.

## Beta Quickstart

```bash
RUN=$(agentic run new --goal "Summarize README" --context README.md --print-run)
agentic run show --run "$RUN"
agentic plan --run "$RUN"
agentic run --run "$RUN"
agentic status --run "$RUN"
agentic status --run "$RUN" --json
agentic verify --run "$RUN"
agentic verify --run "$RUN" --json
```
