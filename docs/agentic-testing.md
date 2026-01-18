# Agentic CLI golden tests

## Overview

Golden snapshots lock the current behavior of `scripts/agentic.mjs` so refactors can be validated without changing outputs. Snapshots cover help, validate, status, flow, agent, retry, and skip.

## How to regenerate goldens

```
npm run test:golden
```

This copies a minimal fixture into a temp folder, runs each CLI command, normalizes output (paths, temp dirs, ISO timestamps), and writes golden stdout/stderr/exit-code files under `tests/agentic/golden/` along with `manifest.json`.
Generation resolves paths from the repo root via `import.meta.url`, so it is independent of your current working directory on Windows, macOS, or Linux.

## How normalization works

- Replaces the working directory path with `<CWD>`.
- Replaces the OS temp directory path with `<TMP>`.
- Converts Windows backslashes to forward slashes.
- Replaces ISO-8601 timestamps with `<ISO_DATE>`.

## How to add a new CLI snapshot

1. Update `tests/agentic/generate-golden.mjs` to include the new command and any required plan mutation.
2. Run `npm run test:golden` to regenerate snapshots.
3. Run `npm test` to confirm snapshots match.

## Running tests

```
npm test
```

Uses `node:test` to compare normalized CLI output against goldens. A fresh temp copy of the fixture is used per test for isolation.

If goldens are missing, tests are skipped with a hint to run `npm run test:golden`. To auto-generate during `npm test`, set `AGENTIC_AUTOGEN_GOLDENS=1` (this will update files under `tests/agentic/golden/`).
