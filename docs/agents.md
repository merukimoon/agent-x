# Agents

This document describes agent responsibilities and the intended interface boundaries. Adjust once the implementation is in place (**TODO**).

## Recommended agent roles

These roles are optional patterns, not mandatory framework constructs.

- **Planner**: Clarifies objectives, decomposes tasks, sets acceptance criteria.
- **Executor**: Produces artifacts (code/docs) and follows the plan.
- **Reviewer**: Checks outputs against requirements; flags risks and regressions.

## Agent responsibilities

An Agent should:

- Be explicit about assumptions and unknowns
- Prefer deterministic behavior where possible (e.g., structured outputs) (**TODO**)
- Avoid side effects unless authorized by tools/runner constraints (**TODO**)

## Intended interface (pseudo)

The framework is expected to standardize a minimal interface similar to:

```text
Agent {
  name: string
  instructions: Prompt
  respond(input: Message | TaskContext) -> Message | Result
}
```

**TODO**: Replace this section with real types once code exists.

## Inter-agent communication

Communication should be:

- Logged and replayable (**TODO**)
- Typed or at least structured (e.g., “plan”, “decision”, “artifact”) (**TODO**)

