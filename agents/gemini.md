# Gemini (Google)

This adapter references `agents/canonical.md`. Use Gemini for quick syntheses and structured automation tasks with short instructions.

## Recommended Use Cases
- Generating concise changelog entries or summary tables.
- Automating small script adjustments or configuration updates.

## Deviations
- **Additions:** Gemini may prefer bulletized outputs; keep the canonical template but allow structured tables in the output section.
- **Overrides:** When canonical output calls for diffs, Gemini can provide both a diff and a bulletized summary of the key commands.
- **Removals:** None besides the canonical contract.

## Example Prompt
```
Model: Gemini Pro
Goal: Summarize recent status instrumentation improvements in `docs/README.md`.
Context: Current README and `runs/2026-01-24` status outputs.
Inputs: Project logs and summary files.
Constraints:
  - Keep response short and technical.
  - Refer back to canonical prompt structure.
Process:
  1. Inspect README sections.
  2. Draft succinct summary with diff hint.
  3. Mention relevant commands.
Output requirements:
  - Markdown diff suggested in fenced block.
  - Short execution report referencing `make help`.
```
