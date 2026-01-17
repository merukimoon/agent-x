# Agents (specifications)

This directory contains **agent specifications**: the stable, reviewable definition of what each agent is responsible for and how it behaves.

This is **not** where implementation code lives. Until a runtime/language is chosen, treat everything here as contract- and policy-level documentation.

## What an “agent directory” represents

Create one folder per agent:

```text
agents/<agent-name>/
```

That folder represents a single agent identity that can participate in a run (e.g., `planner`, `executor`, `reviewer`).

## Expected contents per agent (recommended)

An agent folder SHOULD contain:

- `README.md` Purpose, scope, responsibilities, and non-goals
- (**TODO**) `policy.md` or `policy.yml` Agent-specific constraints (in addition to run Policy)
- (**TODO**) `checklist.md` Definition of done / review checklist for that agent
- (**TODO**) `prompt-map.md` Which prompts (and versions) the agent uses from `prompts/`
- (**TODO**) `examples.md` Example inputs/outputs that conform to `docs/agent-contract.md`

The exact filenames and formats are intentionally not enforced yet.

## Relationship to the Agent Contract

All agents MUST conform to the Agent Contract:

- Canonical contract: `docs/agent-contract.md`
- Summary: `docs/agents.md`

An agent spec SHOULD state which conformance level it targets (L0/L1/L2).

