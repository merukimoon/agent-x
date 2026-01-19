# Planner Retry & Handling Policy

This document defines how upstream orchestrators or operators must handle Planner exit codes.

## Policy Overview
The Planner is **stateless** and **deterministic** in validation. 
- **Do NOT** blindly retry validation failures (Exit 11/12).
- **Do** retry transient network issues (Exit 10).

## Handling by Exit Code

### Exit 0: Success
- **Action**: Proceed.
- **Next Step**:
  - If `needs_clarification=true`: **STOP**. present questions to User.
  - If `needs_clarification=false`: **REVIEW**. Present plan summary to User/Approver.

### Exit 10: Network/Internal Error
- **Meaning**: Transient connection failure, timeout, or API error.
- **Action**: **RETRY**.
- **Strategy**: Exponential backoff (e.g. 500ms, 1s, 2s). Max 3 attempts.

### Exit 11: Schema/Parse Error
- **Meaning**: The LLM failed to follow the JSON format instructions.
- **Cause**: Model capability limit, conflicting prompt instructions, or context window overflow.
- **Action**: **STOP**.
- **Fix**:
  - Check prompt template.
  - Switch to a more capable model (override `LLM_MODEL`).
  - Shorten inputs.
- **Forbidden**: Do not auto-retry with the same inputs and model (likely to fail again).

### Exit 12: Safety/Policy Violation
- **Meaning**: The LLM produced valid JSON but violated safety gates.
  - *Example*: Used `delete_database` when capability was not provided.
  - *Example*: Set risk to `minimal` instead of `low`.
  - *Example*: Generated plan steps AND asked questions simultaneously.
- **Action**: **STOP**.
- **Fix**:
  - Refine prompt constraints.
  - Clarify context.
  - **Do NOT** simply retry, as this indicates alignment failure.

---
## Multi-Model Strategy interaction
- If Exit 11/12 occurs frequently on a "Cheap" model (e.g. Flash/Turbo):
  - Operator MAY attempts a **one-time fallback** to a "Reasoning/High-End" model (e.g. GPT-4o, Claude 3.5 Sonnet) for that specific task.
  - If the high-end model also fails (11/12), the task is considered **infeasible** without human intervention.
