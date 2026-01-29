# Verify.md

## Code Coverage

AgentX enforces a minimum code coverage threshold of **85%** for all metrics (lines, functions, statements, branches).

### Running Coverage Locally

Using pnpm:
```bash
pnpm run test:coverage
```

Using Make:
```bash
make test-coverage
make test-coverage TEST_TMPDIR=/tmp
```

### Coverage Policy

- **Threshold**: 85% minimum for lines, functions, statements, and branches
- **Scope**: Production source code in `packages/**/src/**/*.{ts,tsx}`
- **Exclusions**: 
  - Test files (`**/__tests__/**`, `**/*.test.*`, `**/*.spec.*`)
  - Stress tests (`**/*.stress.test.*`)
  - Build artifacts (`**/dist/**`, `**/build/**`)
  - Dependencies (`**/node_modules/**`)

### CI Enforcement

Coverage is enforced in CI. Pull requests that drop coverage below 85% will fail the build.

Coverage reports are uploaded as CI artifacts for inspection (HTML format, 30-day retention).

### Notes

- Coverage applies only to the main deterministic test suite
- Specialized suites (MCP protections, stress tests) are excluded
- Initial CI runs may fail if current coverage is below threshold — this is expected and drives test improvement

## Verify Flows

Verify Flows is the feature-level confidence pass that confirms all canonical execution flows still work end-to-end after a change. Run it after finishing a feature or refactor, alongside Verify (tooling/contracts) and VerifyFest (broader regression).

Exit codes are meaningful:
- 0 = success
- 1 = failure
- 2 = paused (expected for gated flows)

To automate this sequence, use `make verify-flows`.

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
