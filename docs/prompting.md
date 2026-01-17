# Prompting

This document explains how to write prompts used by agents and how to manage prompt changes over time.

## Prompt principles

- Keep prompts short and task-focused
- Prefer explicit constraints over vague instructions
- Use checklists for repeatable work
- Separate “role” instructions (stable) from “task” inputs (variable)

## Prompt structure (recommended)

When writing a prompt, include:

- Purpose: what the prompt is for
- Inputs: what variables/context it expects
- Output: what shape the response should take
- Constraints: tool use rules, privacy, formatting
- Failure modes: what to do when blocked or unsure

## Versioning prompts

Until there is a dedicated prompt registry, treat prompts as code:

- Review via PRs
- Keep changes small and explained
- Record user-visible prompt changes in `CHANGELOG.md` when they affect behavior (**TODO**)

**TODO**: Decide where prompts live (e.g., `prompts/` directory) and document conventions.

