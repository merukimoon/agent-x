# Canonical Instructions for External Coding Assistants

This document is the single source of truth for how we expect OpenAI Codex / GPT-5.x, Claude, and Gemini to interact with the Agentic Squad Framework repository. Every assistant prompt follows the **Prompt Contract** below. Deviations are documented in the per-assistant adapters.

## What is an External Coding Assistant?
An external coding assistant is a hosted large language model invoked through prompts in English. It reads repository context, obeys constraints, and produces deterministic answers: diffs, commands run, and a short execution report. It is not an internal agent or workflow component.

## Decision Guide
| Assistant | Recommended for |
| ---------- | -------------- |
| Codex / GPT-5.x | Complex TypeScript logic, Makefiles, canonical workflow tasks. |
| Claude (Anthropic) | Longer-form text, documentation, and structured reasoning with safety focus. |
| Gemini (Google) | Multimodal reasoning threads, short syntheses, quick automations. |

Use Codex when the task touches TypeScript contracts or CLI automation. Fall back to Claude when clarity or policy reasoning is paramount. Gemini is acceptable for lightweight summaries or repeatable scripts.

## Prompt Contract Template (copy and reuse)
```
Model: <assistant name / version>
Goal: Brief description of intended change (mention feature or bug).
Context: Repository path, relevant files, previous summaries.
Inputs: List of files, logs, or command outputs provided.
Constraints:
  - Keep changes minimal and releasable.
  - Do not invent new features outside the scope.
  - Never claim commands ran when they did not.
Process:
  1. Inspect provided context.
  2. Plan diff (files to touch, high-level steps).
  3. Emit fixes (apply_patch or narrative instructions).
Output requirements:
  - Unified diff or instructions referencing repo paths.
  - Short execution report with commands run and results.
  - Mention assumptions whenever context is incomplete.
```

## Global Rules
- Do not fabricate terminal output or tests; report only verified commands.
- Explicitly state any assumptions made about missing info.
- Prefer minimal diffs and existing helpers unless the user explicitly asks for more.


## Test Coverage and Verification Rule
Any code change produced by an External Coding Assistant is accepted only if it is verified by unit tests.

Rules:
1. Any new behavior introduced in the codebase MUST be covered by unit tests.
2. Any modification to existing behavior MUST update or add unit tests to reflect the new expected behavior.
3. Unit tests MUST fail before the change and pass after the change.
4. All verification workflows MUST execute the unit test suite.
5. Bypassing tests by deleting meaningful tests, weakening assertions, or reducing coverage to make verification pass is forbidden.

If these conditions are not met, the change is considered invalid and must not be merged.

## Deterministic Changes Rule
- The agent modifies only files required to satisfy the stated goal.
- Unrelated refactors, formatting changes, renames, or cleanup are forbidden unless explicitly requested.
- Changes must be minimal and directly attributable to the declared intent.

## Explicit Intent Declaration Rule
- Before producing changes, the agent declares the intended behavior change.
- The implementation and tests must match the declared intent.
- Undeclared behavior changes are invalid.

## No Silent Contract Changes Rule
- Public interfaces, schemas, run artifacts, and documented contracts must not change silently.
- Any contract change must be explicitly declared and documented.
- Undeclared contract changes are forbidden.

## Failure Transparency Rule
- Failures must be explicit and observable.
- Errors must not be swallowed, downgraded, or hidden to make verification pass.
- Verification failure is treated as a valid and expected outcome.

## Reproducibility Rule
- All changes must be reproducible using documented commands.
- Hidden state, undocumented environment dependencies, or local-only assumptions are forbidden.
- Results must be reproducible in CI and by other engineers.

## Canonical Example
```
Model: Codex / GPT-5.4
Goal: Refine `make/verify.mk` help to include runnable examples.
Context: `make/help.mk`, `make/verify.mk`, existing help output.
Inputs: None beyond repo files.
Constraints:
  - Keep instructions crisp.
  - Use apply_patch for modifications.
Process:
  1. Scan help renderer for usage formatting.
  2. Add examples to each register_target call.
  3. Run `make help` to verify output (describe result in report).
Output requirements:
  - apply_patch diff showing new register_target examples.
  - Execution report summarizing `make help`.
  - Mention assumption: repository uses GNU make-compatible shell.
```
