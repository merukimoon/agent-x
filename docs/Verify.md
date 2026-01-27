# Verify.md

## Verify Flows

Verify Flows is the feature-level confidence pass that confirms all canonical execution flows still work end-to-end after a change. Run it after finishing a feature or refactor, alongside Verify (tooling/contracts) and VerifyFest (broader regression).

Exit codes are meaningful:
- 0 = success
- 1 = failure
- 2 = paused (expected for gated flows)

To automate this sequence, use `make verify-flows`.

### Stress Tests
Tests marked as `*.stress.test.ts` (e.g. MCP Async HTTP) are **non-blocking** and isolated from the main suite. They verify behavior under load or flaky network conditions.

Run them explicitly:
```bash
pnpm run test:mcp-stress
```
If these fail, create an issue for triage. They should not block PR merges unless steady-state reliability is compromised.

### Command sequence

Base flow verification:
- `make verify-flow`
- `make validate-run RUN=<run-id>` (use the RUN from verify-flow output)

Orchestrator validation flow:
- `make orchestrator-validate GOAL="verify" CONTEXT="verify"`
- `make validate-run RUN=<run-id>` (use the RUN printed by orchestrator-validate)

Gated flow (pause expected):
- `make orchestrator-gated-validate GOAL="verify" CONTEXT="verify"`
- Exit code 2 indicates a paused run awaiting human input.

Gated flow resume and validation:
- `make orchestrator-gated-resume RUN=<run-id> DRY=0` (use the RUN from the gated validate output)
- `make validate-run RUN=<run-id>`

Notes:
- Verify Flows may include intentional non-zero exits (code 2) for gated runs; treat these as expected pauses, not failures.
- A feature is complete when Verify, VerifyFest, and Verify Flows all pass (with expected pauses on gated scenarios).
- Unit tests are mandatory for new or changed code; the verification sequence runs tests and fails on any test failure.
