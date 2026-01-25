# Documentation

Start here if you’re new to the project.

Package manager: pnpm (pinned via Corepack). Make targets are contributor convenience only; the supported surface is the CLI (`pnpm run dev ...`). See `docs/adr/ADR-003-package-manager-and-contracts.md` for the canonical decision.

## What to read

- [`docs/concepts.md`](concepts.md) Terminology and mental model
- [`docs/agent-contract.md`](agent-contract.md) Agent Contract (canonical; stable interface for agents)
- [`docs/contracts/agent_contract.md`](contracts/agent_contract.md) Canonical agent inputs/outputs contract
- [`docs/contracts/agent_failure_protocol.md`](contracts/agent_failure_protocol.md) Agent failure protocol
- [`docs/contracts/run_artifacts.md`](contracts/run_artifacts.md) Required run artifacts contract
- [`docs/contracts/run_lifecycle.md`](contracts/run_lifecycle.md) Run lifecycle contract (states, artifacts, verification)
- [`docs/contracts/rules_model.md`](contracts/rules_model.md) Soft rules vs hard constraints model
- [`docs/contracts/verification_contract.md`](contracts/verification_contract.md) Verification pipeline and outcomes
- [`docs/quickstart.md`](quickstart.md) How to run AgenticX v0 (DX quickstart)
- [`docs/status.md`](status.md) Run status sources and CLI viewer
- [`docs/agent_extensibility.md`](agent_extensibility.md) How to add a new agent
- [`docs/release_hygiene.md`](release_hygiene.md) Release hygiene and trust pack
- [`docs/first_success.md`](first_success.md) Canonical first-success path for new users
- [`docs/architecture.md`](architecture.md) High-level structure (as implemented) (**TODO**)
- [`docs/flows.md`](flows.md) Orchestration flows (canonical workflows)
- [`docs/golden-path-v0.md`](golden-path-v0.md) Golden Path v0 (single end-to-end reference run)
- [`docs/adr/ADR-003-package-manager-and-contracts.md`](adr/ADR-003-package-manager-and-contracts.md) pnpm adoption, Make scope (dev-only), contracts package canonicalization
- [`docs/agents.md`](agents.md) Agent roles, responsibilities, and interfaces (**TODO**)
- [`docs/prompting.md`](prompting.md) Writing and managing prompts
- [`docs/examples.md`](examples.md) Usage examples (currently pseudo-code)
- [`docs/run-examples/README.md`](run-examples/README.md) Canonical runnable examples
- [`docs/versioning.md`](versioning.md) Versioning and compatibility policy (**TODO**)
- [`docs/roadmap.md`](roadmap.md) Near-term project direction (**TODO**)
- [`docs/project-status/README.md`](project-status/README.md) Canonical project status, backlog, and decisions

## Verification commands (canonical)

- Quick verification: `make verify-fast`
- Full verification: `make verify`
- Product wiring verification: `make verify-flow`
- Run artifacts contract check: `make validate-run RUN=<RUN>` (alias: `make verify-run RUN=<RUN>` or `pnpm run verify-run --run <RUN>`)
- Orchestrator validation: `make orchestrator-validate GOAL="..." [MODE=planner|planner-architect]` (default mode is planner-architect; runs orchestrator then verify-run)
- Gated flow demo: `make orchestrator-gated-demo GOAL="..." [CONTEXT="..."]` (pauses with exit code 2, writes override.json, resumes, validates)
- Verify Flows: `make verify-flows` (feature-level end-to-end flow verification; gated pause/resume included)
- Planner end-to-end flow (forces LLM planner and full gates): `make e2e-plan-flow GOAL="..." CONTEXT="..."`

Windows note: if `pnpm run test` fails due to temp directory permissions, run `TMPDIR=/tmp pnpm run test`.

## Make targets

### Run validation
`make validate-run RUN=<run-id>`
`make verify-run RUN=<run-id>` (alias to `make validate-run`)

### Execution flows
`make verify-flow`
`make orchestrator-validate GOAL="..." [MODE=planner|planner-architect]`
`make orchestrator-gated-validate GOAL="..." [CONTEXT="..."]`
`make orchestrator-gated-resume RUN=<run-id> DRY=0`
`make orchestrator-gated-demo GOAL="..." [CONTEXT="..."]`

Definitions live in Make/verify.mk for verification targets and Make/execute.mk for execution flows.

## Definition of Done

See `docs/DoD.md` for the feature Definition of Done. A change is complete only after Verify, VerifyFest, Verify Flows, and documentation updates are done.

## Contributing docs

If you update docs:

- Keep language direct and non-marketing
- Prefer short sections and checklists
- Mark unknowns with **TODO** rather than guessing
