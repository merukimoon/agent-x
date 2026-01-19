# Planner Contract (v1)

This document defines the normative contract for the **Planner-only** mode component.

## 1. Role & Scope
The Planner generates execution plans based on a high-level `Goal`, `Context`, and `Capabilities`.

- **DOES**:
  - Receive goal, context, and capabilities as input.
  - Produce a structured JSON plan + assumptions OR clarification questions.
  - Apply deterministic validation gates.
  - Persist artifacts (raw output, validation report, human-readable summary).
- **NEVER DOES**:
  - Execute any plan steps.
  - Modify repository code outside `runs/` artifacts.
  - Infer missing information (must ask questions).
  - Attempt to "repair" invalid plans or JSON.
  - Bypass safety gates.

## 2. Input / Output
### Inputs
- **Goal (string)**: The objective.
- **Context (string)**: Relevant background information or file content.
- **Capabilities (string[])**: Allow-list of valid `action_type` values.

### Output Artifacts
Everything is written to `runs/<RUN_ID>/`:
- `planner_raw.json` (or `planner_failed_raw.txt` on parse error)
- `planner_validation.json` (structured report)
- `planner_summary.md` (human-readable)
- `planner_validation_error.json` (if a failure occurred)

## 3. Validation Gates (The Contract)
The Planner enforces strict mutual exclusivity and schema integrity.

### 3.1 Mutual Exclusivity
- If `needs_clarification = true`:
  - `questions` MUST be a non-empty array.
  - `plan` MUST be an empty array (`[]`).
- If `needs_clarification = false`:
  - `questions` MUST be an empty array (`[]`).
  - `plan` array is allowed (empty plan produces a warning, not failure).

### 3.2 Plan Steps
Every step in `plan[]` MUST satisfy:
- **ID & Title**: Non-empty strings.
- **Action Type**: MUST exactly match an entry in `Capabilities`.
- **Risk**: MUST be strictly `"low" | "medium" | "high"`.
- **Verification**: MUST be a non-empty array of objects with:
  - `method` (non-empty string)
  - `success_criteria` (non-empty string)

### 3.3 Reliability
- **Markdown Stripping**: Outer markdown fences (e.g. ` ```json `) are stripped before parsing. Inner fences are preserved.
- **JSON Only**: Non-JSON output (after stripping) is a fatal error.

## 4. Failure Modes & Exit Codes
The Planner communicates status via exit codes:
- **0 - Success**: Valid plan generated (or valid clarification request).
- **10 - Network/Internal Error**: Retryable transient failure.
- **11 - Schema/Parse Error**: LLM failed to produce valid JSON or required fields. Requires prompt refinement or model swap.
- **12 - Safety/Policy Violation**: Valid JSON but violated gates (e.g. invalid capability, risk enum mismatch, mutual exclusivity logic). Requires prompt refinement.
