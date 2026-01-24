# Decision Map v0.9

## 1. Purpose and Scope
- Define architectural and methodological boundaries for the late v0.x stage.
- Make explicit what is frozen, what may evolve, and what is deferred.
- This is not a canonical model specification; it is a decision map to protect stability while allowing deliberate evolution.

## 2. Current Stage Declaration
- Project maturity: late v0.x, approaching v1 stabilization.
- Intent: stabilize core contracts and verification discipline before adding new infrastructure, agents, or runtime complexity.

## 3. Frozen Decisions (Must Not Change in v1 Without Explicit Version Bump)
- System source of truth: `run.json` is authoritative for run state, lifecycle timestamps, exit codes, and flow identity.
- Step contract: step_result/decision artifacts and their schema versions are required; steps record timestamps, model selection, validation, execution status, and decisions.
- Plan model (DAG): plans are ordered DAGs of steps with explicit ids, dependencies, and agent bindings; no implicit sequencing or hidden steps.
- Verification gates: verification-first remains mandatory; exit codes are contractually meaningful (0 success, 1 error, 2 paused for gated flows).
- Separation of responsibilities: planning, execution, verification, and rendering remain distinct concerns; status and rendering are read-only and do not mutate runs.

## 4. Evolvable Areas (Expected to Change Without Breaking the Model)
- Agent set and roles: agents may be added, renamed, or re-scoped while honoring step contracts and run/layout invariants.
- Orchestration rules: flow selection, retry policies, and gating strictness may adapt within the existing DAG/step framework.
- CLI and UX: commands, flags, and status presentation may improve provided exit code semantics and contracts remain stable.
- Artifact content and shape: result payloads, notes, and auxiliary metadata may expand as long as required artifacts and schemas remain valid.
- Examples and golden paths: examples may be refreshed to reflect current behavior while keeping canonical flows aligned to frozen contracts.

## 5. Deferred Decisions (Explicitly Out of Scope for v0.9)
- Persistence and storage policy: alternative storage backends, retention rules, and archival are deferred.
- Multi-provider LLM runtime: provider selection, routing, and advanced model policy are deferred.
- Agent-to-agent communication (e.g., MCP or similar): cross-agent messaging beyond current plan-driven execution is deferred.
- Security hardening: advanced authZ/authN, secret management, and sandbox policy extensions are deferred.

## 6. Change Policy
- Breaking decisions: changes to frozen items (run.json semantics, step/decision schemas, DAG invariants, exit code semantics, separation of concerns) require an explicit version bump and ADR.
- Evolvable items: may change through normal review; still require updated docs and, where appropriate, verification updates.
- Recording changes: future decisions must be captured as ADRs; frozen-to-evolved transitions must be explicit and versioned.

## 7. Relationship to Canonical Model
- This map precedes and constrains the canonical model; the canonical model must conform to frozen decisions.
- Recommended reading: current contracts (step, decision), run lifecycle docs, verification model ADRs, and this decision map before extending the model.

## 8. Non-Goals and Anti-Patterns
- Non-goals: designing new infrastructure layers, redefining core contracts, or specifying unimplemented features.
- Anti-patterns: implicit state mutation, hidden side effects in verification or rendering paths, silent exit code remapping, and bypassing run.json as the source of truth.

## 9. Status
- Version: v0.9
- Document status: Draft
