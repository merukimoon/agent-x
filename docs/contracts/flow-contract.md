# Flow Contract

## Definition

A **Flow** is a bounded, managed sequence of agent interactions managed by the Orchestrator (Control Layer). It creates a deterministic boundary around agent activities, ensuring that goals are translated into artifacts or actions under strict policy enforcement.

## Terminology

- **Flow**: High-level routine (e.g., "Planning Flow", "Code Modification Flow").
- **Orchestrator**: The **AgentX runtime** system (script/Make) that invokes agents, manages state, and enforces policy. It is **not** an agent.
- **Agent**: A unit of intelligent behavior (e.g., Planner, Reviewer) that accepts inputs and produces outputs.

## Flow Types

### 1. Thinking Flow (e.g., Planner-Only)
- **Scope**: Analysis, planning, and verification.
- **Invariant**: **NO SIDE EFFECTS**. Must not modify code, deploy, or call external write primitives.
- **Outcome**: Produced artifacts (Plan JSON, Summary Markdown).

### 2. Execution Flow (Future/Beta)
- **Scope**: Acting upon a validated plan.
- **Invariant**: Actions must strictly follow the approved plan.
- **Outcome**: Code changes, PRs, or system mutations.

## Inputs & Outputs

### Inputs
Every flow must accept the current **Standard Input Model**:
1.  **Run ID**: Unique correlation ID for the session.
2.  **Goal**: Clear, text-based objective.
3.  **Context**: Project constraints, existing file context, or policy documentation.
4.  **Configuration**: Environment variables (e.g., `LLM_MODEL`) or flags (`--dry-run`).

### Outputs
Every flow must produce:
1.  **Run Directory**: `runs/<RUN_ID>/` containing all artifacts.
2.  **Structured Artifacts**: JSON files representing the machine-readable outcome (e.g., `plan.json`, `validation.json`).
3.  **Human Summary**: A `summary.md` or similar high-level report.
4.  **Semantic Exit Code**:
    - `0`: Success.
    - `10`: Retryable System Error (Network/Internal).
    - `11`: Hard Failure (Input/Schema error).
    - `12`: Safety/Policy Violation (Blocking).

## Responsibilities

### AgentX Orchestrator (Control Layer)
- **Lifecycle**: Creates the run directory, initializes state, and eventually archives/cleans up.
- **Sequencing**: Decides which agent runs next based on dependency graphs or linear pipelines.
- **Policy Enforcement**: Interprets exit codes. Stops immediately on Exit 12 (Safety). Retries on Exit 10 (System).
- **State Management**: Persists the "Cursor" (current step) and prevents partial execution via locking.

### Agents
- **Statelessness**: Agents should effectively be stateless functions: `(Input + Context) -> Output`.
- **Compliance**: Must respect the allowed capability map (e.g., a "Planner" must not try to use "FileSystemWrite" tools).
- **Transparency**: Must allow their internal "reasoning" or "scratchpad" to be captured as artifacts (e.g., `planner_raw.json`).

## Invariants & Guarantees

1.  **Safety First**: Policy checks (Exit 12) always override goal completion.
2.  **Atomic Artifacts**: Outputs should be written atomically where possible to prevent corrupted run states.
3.  **No Ghost Actions**: All side effects (if any) must be traceable to a specific agent step and recorded.
4.  **Human-in-the-loop Ready**: Flows must be pausable or reviewable at critical gates (e.g., between "Plan" and "Execute").
