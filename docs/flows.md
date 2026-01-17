# Orchestration Flows (Canonical)

This document defines canonical, repeatable orchestration flows for the initial agent set:

- Coordinator: [`agents/coordinator/README.md`](../agents/coordinator/README.md)
- Decision Maker: [`agents/decision-maker/README.md`](../agents/decision-maker/README.md)
- CISO: [`agents/ciso/README.md`](../agents/ciso/README.md)

All agent-to-agent interaction MUST conform to the Agent Contract: [`docs/agent-contract.md`](agent-contract.md).

## Run-level concepts

### What a run represents

A run is one attempt to complete a Task by composing multiple agents under one Policy. A run has:

- A stable `run_id`
- A stable `task_id`
- A Policy that applies to all participating agents
- A sequence of agent responses that can be inspected and replayed conceptually

### How artifacts accumulate across a run

- Each agent may emit `artifacts[]` in its contract response.
- The Coordinator is responsible for aggregating artifacts into a coherent run outcome and for avoiding duplication.
- Artifacts are additive by default: later agents may supersede earlier artifacts, but the superseding MUST be recorded as a decision with rationale.

### Partial failures

Runs may partially fail without losing traceability:

- If an agent returns `blocked`, the run is paused until `next_steps[]` are satisfied or the Decision Maker changes scope.
- If an agent returns `error`, the Coordinator either retries with an adjusted input set (if safe) or escalates with a structured summary.
- A run MUST end with a final Coordinator response that summarizes what is complete, what is pending, and what was deferred.

## Manual execution using runs/

This repository supports a manual, language-agnostic run workflow. The goal is consistency and traceability, not automation.

### Create a run

From the repository root:

- `make run-new NAME="<short-slug>"`

This creates a new folder under `runs/` with a UTC timestamp prefix, for example:

- `runs/2026-01-17_0930-docs-pr-audit/`

List a run’s contents:

- `make run-tree RUN="<run-folder-name>"`

### Fill inputs

In the run folder:

- `inputs/request.md` contains the TaskRequest: goal, inputs, acceptance criteria, and key policy constraints.
- `inputs/context.md` contains supporting context: links, excerpts, and relevant repository state.

### Record agent outputs

Each participating agent writes its contract response and notes to:

- Coordinator: `outputs/coordinator/result.json` and `outputs/coordinator/notes.md`
- Decision Maker: `outputs/decision-maker/result.json` and `outputs/decision-maker/notes.md`
- CISO: `outputs/ciso/result.json` and `outputs/ciso/notes.md`

Agents MUST keep `result.json` aligned with `docs/agent-contract.md` for required fields and status semantics.

### Store artifacts

If the run produces files, diffs, or structured reports, store them under:

- `artifacts/`

Reference any produced artifacts from the corresponding agent `result.json` and from the final summary.

### Produce the final summary

The Coordinator produces the end-of-run aggregation in:

- `summary/final.md`

The final summary should capture: outcome, key decisions, artifacts produced, and follow-up actions.

## Flow A: Documentation or PR completion

Purpose: gate documentation updates behind a security and compliance review and explicit approval when tradeoffs exist.

### Trigger

- Documentation updated (direct commit or PR merged).
- A PR that changes policy, prompts, schemas, or agent specs is merged.

### Participating agents

- Coordinator (drives the flow)
- CISO (review gate)
- Decision Maker (approval and tradeoffs)

### Steps (bullet-based flow)

1) Trigger occurs.
2) Coordinator collects context and artifacts.
3) Coordinator determines required checks and sends review request to CISO.
4) CISO reviews artifacts and emits a SecurityComplianceReport artifact.
5) Coordinator forwards findings and any tradeoffs to the Decision Maker.
6) Decision Maker approves, rejects, or requests changes.
7) Coordinator produces the run summary and routes any follow-up work.

### Sequence (ASCII)

```text
Trigger
  |
  v
Coordinator ---> CISO
    |             |
    |<--- report--|
    |
    +-----------> Decision Maker
    |               |
    |<--- decision--|
    |
    v
Coordinator (final summary)
```

### Inputs per agent

Coordinator inputs:

- TaskRequest describing what changed and why (goal and acceptance criteria).
- Context containing the changed artifacts (paths, diffs, or contents).
- Policy for the run (allowed tools, privacy rules, logging requirements).
- Context listing available agents and their specs.

CISO inputs:

- The artifacts to review (as references or payloads).
- The run Policy (especially privacy and logging constraints).
- Baseline repository docs relevant to security and compliance (for example, `LICENSE`, `SECURITY.md`, `CODE_OF_CONDUCT.md`).

Decision Maker inputs:

- The CISO report artifact and a summary of findings.
- Explicit options when tradeoffs exist, including who is impacted and what is at risk.
- Acceptance criteria to decide against.

### Outputs per agent

Coordinator outputs:

- A response that includes routing decisions and assigned next steps.
- A final run summary artifact (conceptual) as a `data` artifact when useful.

CISO outputs:

- A `data` artifact shaped like `SecurityComplianceReport` (see `agents/ciso/README.md`).
- Decisions that classify blocking versus warning findings.
- Remediation next steps.

Decision Maker outputs:

- A decision record: approve, reject, or request changes, with rationale.
- Delegated next steps back to the Coordinator with constraints.

### Decision points

- Decision Maker: whether to accept risk, request changes, or reject the outcome.
- Coordinator: whether findings can be remediated within scope or require re-scoping.

### Escalation points

- Any blocking CISO finding escalates to the Decision Maker.
- Any legal, compliance, or disclosure commitment escalates to a human maintainer (**TODO** define thresholds).

### Artifacts produced

- CISO: `SecurityComplianceReport` (data artifact).
- Coordinator: run summary (data artifact, optional), and a consolidated list of next steps.

## Flow B: Architecture or design change proposal

Purpose: make design changes explicit, reviewable, and decision-traceable, with clear ownership for tradeoffs.

### Trigger

- A proposal to change architecture, contracts, schemas, or repository layout.
- A conflict between existing documentation and an intended implementation direction.

### Participating agents

- Coordinator (drives structure and routing)
- Decision Maker (owns decisions)
- CISO (gates on security and compliance impacts)

### Steps (bullet-based flow)

1) Trigger occurs with a proposed change.
2) Coordinator normalizes the proposal into options and acceptance criteria.
3) Coordinator requests CISO review if the proposal touches security, privacy, policy, prompts, or schemas.
4) CISO emits findings and classification (block or warning).
5) Coordinator compiles a decision request: options, constraints, findings, and recommended path.
6) Decision Maker selects an option, sets constraints, and delegates follow-up work.
7) Coordinator records the decision outcome and produces a run summary that is ready to implement later.

### Inputs per agent

Coordinator inputs:

- The proposal text and the affected areas (for example, `docs/agent-contract.md`, `schemas/`, `runs/`).
- Constraints (policy, compatibility requirements, versioning expectations).
- Any prior decisions that apply.

CISO inputs (if in scope):

- The proposal and impacted artifacts.
- The run Policy and any privacy constraints.

Decision Maker inputs:

- A structured decision request with explicit options and tradeoffs.
- CISO findings when available.
- Compatibility and migration expectations (**TODO** define in `docs/versioning.md` when implementation exists).

### Outputs per agent

Coordinator outputs:

- A decision request artifact (conceptual) as `data` if helpful.
- Clear `next_steps[]` assignments for drafting and review.

CISO outputs (if in scope):

- Findings with classification and recommended mitigations.

Decision Maker outputs:

- A recorded decision with rationale and scope.
- Delegation to Coordinator for execution planning and documentation updates.

### Decision points

- Decision Maker: selects an option or defers with explicit next steps and owners.
- Coordinator: determines whether the proposal is sufficiently specified to proceed or is blocked.

### Escalation points

- Blocking CISO findings escalate to the Decision Maker and may require human risk acceptance.
- Any change that implies legal or licensing commitments escalates to a human maintainer (**TODO** define thresholds).

### Artifacts produced

- Coordinator: decision request (optional data artifact) and run summary (optional data artifact).
- Decision Maker: decision record (data artifact, optional) and delegated next steps.
- CISO: findings report (data artifact) when in scope.
