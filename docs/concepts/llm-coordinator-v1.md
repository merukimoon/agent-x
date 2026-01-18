# LLM Coordinator v1 (Planner-only)

## Status
Draft (v1). Planner-only. Execution is owned by the engine.

## Goal
Use an LLM only as a **planner**:
- LLM proposes a plan and candidate actions.
- Engine verifies and executes.
- Rules remain the fallback and circuit breaker.

## Core Principle (Contract)
1. **LLM proposes**
   - Generates a structured plan.
   - States assumptions explicitly.
   - Never claims verification or execution.

2. **Engine verifies**
   - Validates schema and constraints.
   - Checks tool availability and capability boundaries.
   - Runs deterministic verification and execution.
   - Rejects or repairs plans that do not pass gates.

3. **Rules remain fallback**
   - If LLM output is invalid, risky, or unverified, engine falls back to rules.
   - Rules define the safe default behavior.

## Scope (v1)
### In scope
- Planner-only prompt and output schema.
- Guardrails and validation gates.
- Failure modes and fallback logic definition.
- One minimal golden-path example.

### Out of scope (Non-goals)
- Implementing the engine executor.
- Tool integrations (MCP, n8n, GitHub Actions, etc.).
- Multi-agent orchestration beyond a single planner output.
- “Autonomous” execution without deterministic verification.

## Inputs and Outputs
### Planner inputs
- Goal statement
- Constraints (policy, safety, formatting, time, cost)
- Capability map (what tools exist)
- Relevant context (repo structure, conventions, existing docs)

### Planner output (required)
- A single JSON object conforming to the schema in the canonical prompt.
- No extra prose outside the JSON.

## Output Schema (High-level)
Planner must produce:
- `goal`: concise objective
- `assumptions[]`: explicit assumptions (each labeled)
- `needs_clarification`: boolean
- `questions[]`: required only when `needs_clarification=true`
- `plan[]`: ordered steps, each with:
  - `id`
  - `action_type` (enum)
  - `inputs`
  - `expected_output`
  - `verification`
  - `risk` (low|medium|high)
  - `rollback` (optional)

## Guardrails (Must-have)
### 1) Schema-first output
- Output must be valid JSON.
- Must match required fields and enums.
- Engine rejects invalid JSON, missing fields, or unknown enums.

### 2) Capability gating
- Planner can reference only actions that exist in the engine capability map.
- No invented tools, no implied execution.

### 3) Verification per step
- Each step must declare a verification method.
- “Looks good” is not verification.

### 4) Risk tagging
- Every step must include `risk`.
- `high` risk steps require stricter verification gates or must be split into smaller steps.

### 5) Fail-fast for uncertainty
- If the planner cannot produce a safe plan, it must set:
  - `needs_clarification=true`
  - Provide concrete `questions[]`
  - Provide no `plan[]` (or only a placeholder plan with a single clarification step, depending on your preference).

## Engine Validation Gates (Suggested)
Engine should validate at minimum:
- JSON parse + schema validation
- Step atomicity (no “do everything” steps)
- Inputs completeness for each step
- Tool/capability availability
- Risk thresholds policy
- Forbidden actions policy
- Deterministic verification feasibility

## Failure Modes and Fallbacks
### Common failure modes
- Invalid JSON or schema mismatch
- Hallucinated tools/actions
- Missing verification steps
- Hidden assumptions
- Over-broad steps
- Unsafe or policy-violating actions

### Fallback behavior
- If any gate fails:
  - Engine rejects the plan
  - Engine falls back to rules-based default behavior
  - Optionally requests clarification via a deterministic template

## Versioning and Evolution
- v1 is planner-only, no autonomy.
- v2 may add:
  - plan repair loop (LLM proposes fix after engine error report)
  - structured tool selection (still engine-owned execution)
- v3 may add:
  - constrained multi-agent planning (still verified by engine)

## Acceptance Criteria (v1)
- Planner output is strictly structured (JSON schema).
- Engine can deterministically validate the plan without interpretation.
- Fallback is always available and safe.
- Golden-path example is runnable conceptually (input → plan JSON → engine gates).

## Files (Expected)
- `/docs/concepts/llm-coordinator-v1.md` (this document)
- `/prompts/canonical/llm-coordinator-v1-planner.prompt.md` (canonical prompt + full JSON schema)
- `/examples/golden-path/coordinator-planner-only.md` (one minimal example)