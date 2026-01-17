# Concepts

This page defines project terminology. If a term is not yet implemented, it is marked **TODO**.

## Agent

An Agent is a unit of behavior that produces outputs based on:

- Instructions (prompt)
- Context (inputs, prior messages, state)
- Optional tool access (**TODO**)

## Squad

A Squad is a group of Agents coordinated to complete a Task. Squads may be:

- Fixed (predefined set of agents) (**TODO**)
- Dynamic (agents selected based on task) (**TODO**)

## Task

A Task is a bounded unit of work with:

- Goal statement
- Inputs/artifacts to use
- Constraints (time, allowed tools, privacy) (**TODO**)
- Expected output shape (text, patches, report) (**TODO**)

## Orchestrator / Runner

The Orchestrator (or Runner) is responsible for:

- Scheduling agent turns
- Routing messages and artifacts
- Enforcing constraints (tools, budgets) (**TODO**)
- Producing the final Result

## Tool

A Tool is a controlled capability exposed to an agent (e.g., filesystem access, search, API calls) (**TODO**). Tools should be:

- Explicitly declared
- Logged/auditable
- Permissioned/limited by default (**TODO**)

## Prompt

A Prompt is the versioned instruction content used by an Agent. See `docs/prompting.md` for guidelines.

