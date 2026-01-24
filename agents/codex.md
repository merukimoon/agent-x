# OpenAI Codex / GPT-5.x

This adapter mirrors `agents/canonical.md`. Use it when Codex or GPT-5.x is the assistant in use.

## Recommended Use Cases
- Complex TypeScript or Makefile edits.
- Adding new CLI targets or flows.
- Propagating verification instructions across subsystems.

## Deviations from Canonical
- **Additions:** Call out that Codex excels at applying `apply_patch` with explicit diffs.
- **Overrides:** When constraints mention “keep changes minimal,” Codex interprets that as editing only requested files unless otherwise noted.
- **Removals:** No extra removal rules beyond the canonical doc.

## Example Prompt
```
Model: Codex / GPT-5.4
Goal: Add help examples to `make/verify.mk` so each target has a runnable command.
Context: Repository uses `make/help.mk` with `register_target`.
Inputs: Edited `make/verify.mk`, help output sample.
Constraints:
  - Use apply_patch.
  - Keep descriptions unchanged.
Process:
  1. Review each `register_target`.
  2. Add example commands.
  3. Run `make help` and mention the output.
Output requirements:
  - Diff with register changes.
  - Execution report referencing `make help`.
```
