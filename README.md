# Agentic Squad Framework

Framework for building and running small “squads” of cooperating agents to complete engineering tasks.

This repository is currently in early scaffolding. Where details are not yet implemented or confirmed, this documentation uses **TODO** markers.

## Who this is for

- Engineers who want to build agent-based workflows (single agent or multi-agent).
- Contributors who want to help define the framework’s API, runtime, and best practices.

## Core concepts (intended)

These terms describe the intended shape of the project; adjust as the codebase evolves (**TODO**).

- **Agent**: A unit of behavior with instructions, context, and access to tools.
- **Squad**: A collection of agents coordinated to complete a task.
- **Task**: A bounded unit of work with inputs, constraints, and expected outputs.
- **Orchestrator/Runner**: The component that schedules tasks, routes messages, and manages state.
- **Prompt**: Versioned instructions/templates used by agents.

More detail: `docs/concepts.md`.

## Quick start

This repo does not yet publish an installable package (**TODO**). For now:

1) Clone the repo
2) Read the docs index: `docs/README.md`
3) If you’re contributing, follow: `CONTRIBUTING.md`

## Minimal usage example (pseudo-code)

```text
agentA = Agent(name="planner", prompt="...")           # TODO: actual API
agentB = Agent(name="executor", prompt="...")          # TODO: actual API

squad = Squad(agents=[agentA, agentB])                 # TODO: actual API
result = squad.run(task="Add a README and templates")  # TODO: actual API

print(result.output)
```

## Repository structure

- `.github/` GitHub issue/PR templates and workflows
- `agents/` Agent specifications (no implementation code)
- `docs/` User and contributor documentation
- `prompts/` Versioned prompts used by agents
- `schemas/` Schemas for structured inputs/outputs and contracts
- `runs/` Execution outputs and produced artifacts (usually not committed)
- `LICENSE` Project license (MIT)

## Documentation

- Getting oriented: [`docs/README.md`](docs/README.md)
- Architecture overview: [`docs/architecture.md`](docs/architecture.md)
- Orchestration flows: [`docs/flows.md`](docs/flows.md)
- Concepts and terms: [`docs/concepts.md`](docs/concepts.md)
- Agent Contract (canonical): [`docs/agent-contract.md`](docs/agent-contract.md)
- Agent roles and interfaces: [`docs/agents.md`](docs/agents.md)
- Prompting guidance: [`docs/prompting.md`](docs/prompting.md)
- Examples: [`docs/examples.md`](docs/examples.md)
- Versioning policy: [`docs/versioning.md`](docs/versioning.md)
- Roadmap: [`docs/roadmap.md`](docs/roadmap.md)

## Contributing

See `CONTRIBUTING.md` for setup, workflow, and PR expectations.

## Security

See `SECURITY.md` for vulnerability reporting.
