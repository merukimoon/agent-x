# Prompts (versioned)

This directory contains **versioned prompt definitions** used by agents.

Prompts are treated as part of the system’s interface: they should be reviewable, attributable, and versioned. No runtime assumptions are made here.

## Organization (recommended)

Organize prompts so it’s clear:

- which agent uses the prompt
- what the prompt is for
- what version is active

Suggested layout:

```text
prompts/<agent-name>/<prompt-name>/vX.Y/README.md
```

Where:

- `<agent-name>` matches the agent spec folder name in `domain/agents/`
- `<prompt-name>` is a short identifier (e.g., `planning`, `review`, `execution`)
- `vX.Y` is the prompt version (see “Versioning”)

This repo does not enforce this structure yet; it is a convention to adopt during implementation (**TODO**).

## Versioning

Prompts SHOULD be versioned explicitly:

- Use `vX.Y` (recommended) or another clear scheme (**TODO** confirm)
- Treat prompt edits like API changes:
  - Breaking behavioral changes SHOULD bump `X`
  - Backwards-compatible clarifications SHOULD bump `Y`

When a prompt version is superseded, keep the old version available for reproducibility unless there is a security/privacy reason to remove it.

## Relationship between agents and prompts

- Agents SHOULD reference prompts by an identifier and version (e.g., `planning@v0.2`).
- Agent specs in `domain/agents/` SHOULD document which prompts they use and why.
- Prompt expectations SHOULD align with `docs/agent-contract.md` (inputs, outputs, constraints).

