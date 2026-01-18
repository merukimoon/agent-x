# Agentic CLI architecture

## Purpose
- Entry CLI for running agent flows: coordinator-driven planning, agent execution, validation, status.
- Keeps all runtime in Node.js ESM with explicit, typed-by-JSDoc boundaries.

## Entry point (agentic.js)
- Thin wrapper with shebang; imports `main()` and fatal error handler, invokes routing with argv.

## Routing (main.js)
- Parses the first command token, dispatches to CLI handlers, prints usage for help or errors, and surfaces failures consistently via `fail`.

## CLI parsing & handlers (cli.js)
- Contains argument parsing helpers, command handlers (agent, flow, validate, retry, skip, status), and flow orchestration logic.
- Handlers call domain modules; no business logic lives in main.js or agentic.js.

## Domain modules
- rules.js: loads/validates rule packs, matches keywords, classifies flow type and confidence.
- plan.js: plan schema validation, load/persist plan.json, filesystem validation of referenced inputs/outputs.
- agents.js: runAgent implementation, dependency gating, canonical output path helpers.
- status.js: step transition rules and helpers.
- lock.js: flow-level lock creation/removal to prevent concurrent runs.
- fs.js: read/write helpers (atomic writes, excerpts, input checks) reused by agents and plan.
- core.js / errors.js: shared constants, type guards, usage text, and CLIError/fatal error helpers.

## Adding a new CLI command (checklist)
- Define argument parsing and a handler in `cli.js` (reusing parse helpers if possible).
- Route the new command name in `main.js`.
- Implement domain logic in the appropriate module (or a new focused module), not in `cli.js`.
- Preserve existing usage/help formatting and error handling via `fail`/CLIError.
- Update tests/goldens if the user-facing output legitimately changes.
