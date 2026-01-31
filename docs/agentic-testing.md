# ADX CLI golden tests

## Overview

Golden snapshots lock the current behavior of ADX (the `agentic` CLI) so refactors can be validated without changing outputs. Snapshots cover help, validate, status, flow, agent, retry, and skip.

## How to regenerate goldens

```
pnpm run test:golden
```

This copies a minimal fixture into a temp folder, runs each CLI command, normalizes output (paths, temp dirs, ISO timestamps), and writes golden stdout/stderr/exit-code files under `tests/agentic/golden/` along with `manifest.json`.
Generation resolves paths from the repo root via `import.meta.url`, so it is independent of your current working directory on Windows, macOS, or Linux.

## How normalization works

- Replaces the working directory path with `<CWD>`.
- Replaces the OS temp directory path with `<TMP>`.
- Converts Windows backslashes to forward slashes.
- Replaces ISO-8601 timestamps with `<ISO_DATE>`.

## How to add a new CLI snapshot

1. Update `packages/cli/src/__tests__/integration/generate-golden.ts` to include the new command and any required plan mutation.
2. Run `pnpm run test:golden` to regenerate snapshots.
3. Run `pnpm run test` to confirm snapshots match.

## Running tests

```
pnpm run test
```

Uses `node:test` to compare normalized CLI output against goldens. A fresh temp copy of the fixture is used per test for isolation.

If goldens are missing, tests are skipped with a hint to run `pnpm run test:golden`. To auto-generate during `pnpm run test`, set `AGENTIC_AUTOGEN_GOLDENS=1` (this will update files under `tests/agentic/golden/`).
