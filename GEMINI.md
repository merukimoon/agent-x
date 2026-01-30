## External Coding Assistants

This repository defines a canonical documentation hub for the external coding assistants that help contribute to Agentic Squad Framework work. These assistants are not the internal `Agents/` implementations; they are the hosted AI copilots (Codex/GPT-5, Claude, Gemini) that consume prompts, produce diffs, and follow the repo’s contracts.

### Reference Guide
1. Start with `agents/canonical.md`, the single source of truth for how assistant prompts are structured, how assumptions are handled, and what output format is required.
2. Consult the adapter for the assistant you are invoking:
   * `agents/codex.md`
   * `agents/claude.md`
   * `agents/gemini.md`
3. Apply any deviations noted in the adapter files on top of the canonical instructions.

### Usage
- Always read the canonical prompt contract before crafting instructions.
- Apply assistant-specific overrides from the adapter file of the agent you are using.
- Keep references relative so they work in any checkout.
