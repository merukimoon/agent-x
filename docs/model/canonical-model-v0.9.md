# Canonical Model v0.9

## 0. Purpose and Positioning
- Describe the Agentic Squad Framework model as it exists at v0.9.
- Align with decision-map-v0.9.md and its frozen/evolvable/deferred boundaries.
- Not covered: implementation details, schemas, code, or future designs.

## 1. System Overview
- The framework is governance-first and run-based. Each run is the authoritative record for a unit of work.
- Execution is planned, executed, and verified through deterministic, explicit steps.
- Verification is a first-class concern; correctness and auditability outweigh raw throughput.

## 2. Core Concepts
### 2.1 Run
- A run is the unit of execution and the source of truth for state, lifecycle, and identity.
- Lifecycle (conceptual): created → in progress → done/failed/paused (gated) → inspected.

### 2.2 Plan
- A plan is a DAG of steps with explicit ids and dependencies; no implicit ordering.
- The planner produces plans that bind agents to steps and respect DAG constraints.

### 2.3 Step
- A step is the atomic unit of execution.
- Conceptual step contract: records timing, inputs, chosen model, validation results, execution status, decision, and outputs.
- Artifacts are explicit step outputs; they do not mutate prior artifacts.

### 2.4 Agent
- An agent is a role-based executor bound to a step.
- Agent identity is distinct from system state; agents do not own global state.

## 3. Execution Model
### 3.1 Planning Phase
- Plans are produced before execution by a planner role.
- Valid plans are DAGs with explicit dependencies and step-to-agent bindings.

### 3.2 Execution Phase
- Steps run respecting DAG dependencies; completion is distinct from success.
- Execution outcomes are explicit (ok/failed/blocked) and recorded per step.

### 3.3 Verification Phase
- Verification is mandatory and separate from execution; execution success does not imply verified correctness.
- Verification consumes recorded artifacts and does not mutate run state.

## 4. State and Artifacts
- Run state lives in the run; `run.json` is the authoritative record.
- Artifacts are immutable once written; new information is appended as new artifacts.
- Status and views are derived read-only from recorded state; rendering does not change state.

## 5. Responsibility Boundaries
- Planner: produce a valid DAG plan with explicit dependencies and agent bindings.
- Coordinator/Orchestrator: drive execution according to the plan, enforce ordering and gates.
- Agent: perform a step’s work, emit step artifacts, and adhere to the step contract.
- Verifier: assess artifacts, enforce contracts, and signal correctness; read-only.
- Renderer/CLI: present status and artifacts; read-only and non-mutating.

## 6. Failure and Exit Semantics
- Failure is an explicit state recorded in run artifacts; no hidden partial success.
- Exit codes are part of the contract: 0 success, 1 error, 2 paused (gated/human input required).
- Gated pauses are intentional and observable; resumption is explicit.

## 7. What This Model Optimizes For
- Determinism: explicit plans, ordered steps, and recorded decisions.
- Auditability: authoritative runs, immutable artifacts, and visible decisions.
- Debuggability: clear states, explicit exits, and separated concerns.
- Long-term evolution: stable cores with clearly marked evolvable areas.

## 8. What This Model Explicitly Does Not Optimize For
- Raw speed or minimal ceremony.
- Fully autonomous agents without oversight.
- Heuristic-driven or implicit execution paths.

## 9. Relationship to the Decision Map
- This canonical model is constrained by decision-map-v0.9.md.
- Changes to the model require corresponding updates to the decision map.

## 10. Version and Status
- Version: v0.9
- Status: Canonical
- Scope: describes the current model; no future or speculative behavior included.
