# Architecture (high-level)

The repository is currently in documentation scaffolding and does not yet include an implemented runtime (**TODO**). This document describes the intended architecture so future implementation stays coherent.

## Goals

- Keep the core small and composable
- Separate “agent logic” from “orchestration/runtime”
- Make prompts, configuration, and examples easy to audit and version

## Proposed components (**TODO** confirm once code exists)

- **Core types**: Agent, Squad, Task, Message, Result
- **Orchestrator**: Runs tasks, routes messages, manages state
- **Tool interface**: A constrained way for agents to interact with the outside world
- **Prompt management**: Storage, versioning, and composition of prompts
- **Provider adapters**: Model/API adapters (if applicable) (**TODO**)

## Data flow (typical)

1) A caller creates a Task (goal + inputs + constraints)
2) The Orchestrator selects or constructs a Squad
3) Agents exchange Messages and call Tools (if enabled)
4) The Orchestrator aggregates outputs into a Result

## Non-goals (for now)

- A full hosted service (unless explicitly added later) (**TODO**)
- A large plugin ecosystem before the core stabilizes (**TODO**)

