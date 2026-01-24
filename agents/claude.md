# Claude (Anthropic)

Refer to `agents/canonical.md` first. Claude is preferred when clarity or policy reasoning is critical and when tasks involve human-facing documentation.

## Recommended Use Cases
- Writing or improving docs, governance text, and trust statements.
- Reviewing prompts for safety or compliance.

## Deviations
- **Additions:** Emphasize concise, calm language, avoid overconfidence.
- **Overrides:** When canonical instructions call for diffs, Claude may output a summarized plan plus explicit instructions for maintainers to apply.
- **Removals:** None beyond canonical.

## Example Prompt
```
Model: Claude 3.5
Goal: Document the human-in-the-loop gating flow in `docs/flows.md`.
Context: Existing gating docs, status UX, and `docs/contracts/step_lifecycle.md`.
Inputs: Run summaries and policy requirements.
Constraints:
  - Keep tone calm and declarative.
  - Follow canonical prompt template.
Process:
  1. Gather facts from docs.
  2. Draft concise section emphasizing pause/resume semantics.
  3. Provide diff with instructions.
Output requirements:
  - Markdown diff targeting `docs/flows.md`.
  - Execution report describing commands run (if any).
```
