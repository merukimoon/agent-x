# AgentX Orchestration Flows (Canonical)

This document defines canonical, repeatable orchestration flows for the initial agent set:

- Coordinator: [`domain/agents/coordinator/README.md`](../domain/agents/coordinator/README.md)
- Decision Maker: [`domain/agents/decision-maker/README.md`](../domain/agents/decision-maker/README.md)
- CISO: [`domain/agents/ciso/README.md`](../domain/agents/ciso/README.md)
- Tech Lead: [`domain/agents/tech-lead/README.md`](../domain/agents/tech-lead/README.md)
- Architect: [`domain/agents/architect/README.md`](../domain/agents/architect/README.md)
- DBA: [`domain/agents/dba/README.md`](../domain/agents/dba/README.md)
- DevOps: [`domain/agents/devops/README.md`](../domain/agents/devops/README.md)
- Data Scientist: [`domain/agents/data-scientist/README.md`](../domain/agents/data-scientist/README.md)
- QA: [`domain/agents/qa/README.md`](../domain/agents/qa/README.md)
- Technical Writer: [`domain/agents/technical-writer/README.md`](../domain/agents/technical-writer/README.md)
- Legal: [`domain/agents/legal/README.md`](../domain/agents/legal/README.md)
- PR Reviewer: [`domain/agents/pr-reviewer/README.md`](../domain/agents/pr-reviewer/README.md)

All agent-to-agent interaction MUST conform to the Agent Contract: [`docs/agent-contract.md`](agent-contract.md).

## Human-in-the-loop gated runs

Gated runs pause intentionally for human input. The `human_gate` step blocks execution until an override is provided.

- Exit codes: `0` = success, `1` = error, `2` = paused (human input required).
- Canonical gated flow: `make orchestrator-gated-validate GOAL="..." [CONTEXT="..."]`
- Resume a paused run: `make orchestrator-gated-resume RUN="<run-id>" DRY=0`
- Automated demo (pause → override → resume → validate): `make orchestrator-gated-demo GOAL="..." [CONTEXT="..."]`

Lifecycle:
1) Start: run `orchestrator-gated-validate` (or the demo). The flow scaffolds inputs and runs `human_gate`.
2) Pause: flow exits with code 2 and prints the RUN_ID plus guidance to add an override.
3) Inspect: read `runs/<run-id>/outputs/human_gate/notes.md` for the human prompt.
4) Override: write `runs/<run-id>/outputs/human_gate/override.json` (schema `step-override.v1`) to approve or continue.
5) Resume: run `make orchestrator-gated-resume RUN="<run-id>" DRY=0`.
6) Validate: run `make validate-run RUN="<run-id>"` to confirm artifacts are consistent.

Artifacts for the gated step:
- `outputs/human_gate/result.json` (written on pause)
- `outputs/human_gate/notes.md` (operator instructions / human prompt)
- `outputs/human_gate/status.json` (blocked status metadata)
- `outputs/human_gate/override.json` (written by the operator to resume; must match `step-override.v1`)

Operator UX on pause:
- Console output includes RUN_ID, the blocked step, where to inspect notes, where to place `override.json`, and how to resume.
- Use `make run-status RUN="<run-id>"` to view current state; status is read-only.

## AgentX Orchestration rules and invariants

These rules apply to all flows in this document.

- One Decision Maker per run. The Decision Maker is the single approval authority.
- The Coordinator owns orchestration and aggregation and must not make final decisions on tradeoffs.
- QA outputs must classify findings as blocking or non blocking.
- CISO and Legal outputs must classify findings as blocking or warning, where warning is treated as non blocking.
- All blocking findings must be resolved or explicitly accepted by the Decision Maker.
- The Coordinator must always produce a final run summary, even if the run is blocked or partial.
- Agents must record decisions and next steps in the Agent Contract envelope.
- Outputs must be inspectable and stored under `runs/<run-id>/` using the manual run layout.

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

For additional agents, create matching folders under `outputs/` as needed, for example:

- `outputs/qa/`
- `outputs/technical-writer/`
- `outputs/legal/`
- `outputs/tech-lead/`
- `outputs/architect/`
- `outputs/dba/`
- `outputs/devops/`
- `outputs/data-scientist/`
- `outputs/pr-reviewer/`

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

This flow is the canonical **AgentX Orchestration** definition for documentation or PR completion. It supersedes the earlier minimal flow by making quality, security, and legal checks explicit gates. For a full example run, see `docs/run-examples/pr-completion/README.md`.

Purpose: gate documentation and PR outcomes behind documentation review, QA gates, security review, legal compliance review, and explicit approval when tradeoffs exist.

### Trigger

- Documentation updated (direct commit or PR merged).
- A PR that changes policy, prompts, schemas, or agent specs is merged.

### Participating agents

Mandatory:

- Coordinator
- Technical Writer
- QA
- CISO
- Legal
- Decision Maker
- PR Reviewer (mandatory for PRs that change code or configuration)

Optional (pulled in by scenario):

- Tech Lead (if technical changes, not purely docs)
- DevOps (if operational impact)
 
Notes:

- If the PR is docs only, PR Reviewer is optional unless explicitly requested.

### Ordered agent execution

1) Coordinator
2) PR Reviewer (if required by PR scope)
3) Technical Writer
4) QA
5) CISO
6) Legal
7) Decision Maker
8) Coordinator (final summary)

### Inputs per agent

Coordinator inputs:

- TaskRequest describing what changed and why (goal and acceptance criteria).
- Context containing changed artifacts (paths, diffs, or contents).
- Policy for the run (privacy rules, allowed tools, logging requirements).
- Context listing available agents and their specs.

Technical Writer inputs:

- Artifacts in scope and intended audience (if provided).
- Source of truth references to validate against (for example, `docs/agent-contract.md`, `docs/flows.md`).

QA inputs:

- Acceptance criteria and risk areas from Coordinator and Technical Writer outputs.
- Artifacts to validate and any required checks.

PR Reviewer inputs:

- PR link and diff summary, or equivalent change set description.
- Reference docs or decisions relevant to the change.
- Policy constraints for handling sensitive code and copying content.

CISO inputs:

- The artifacts to review (as references or payloads).
- The run Policy (especially privacy and logging constraints).
- Baseline repository docs relevant to security and compliance (for example, `LICENSE`, `SECURITY.md`, `CODE_OF_CONDUCT.md`).

Legal inputs:

- Repository license and notices (for example, `LICENSE`) and any changed licensing related content.
- Any dependency or third party asset licensing context, if applicable (**TODO** when dependencies exist).

If the PR includes dependency changes, the PR Reviewer must call out dependency scope and risks so that CISO and Legal reviews cover them explicitly.

Decision Maker inputs:

- Aggregated findings and options from Coordinator.
- QA, CISO, and Legal findings classified as blocking or non blocking.
- Any tradeoffs and scope questions that require approval.

### Outputs per agent

Coordinator outputs:

- Routing decisions and assigned next steps.
- Final run summary in `runs/<run-id>/summary/final.md`.

Technical Writer outputs:

- Documentation review findings and a concrete update plan (data artifact recommended).
- Next steps for documentation edits and consistency fixes.

QA outputs:

- Test strategy and quality gates (data artifact recommended).
- Classification of quality issues as blocking or non blocking.

PR Reviewer outputs:

- A PRReviewReport data artifact with findings categorized and marked as blocking or non blocking.
- Risk assessment and test impact notes.
- Explicit escalations to QA, CISO, or Legal when needed.

CISO outputs:

- A `data` artifact shaped like `SecurityComplianceReport`.
- Classification decisions for blocking versus warning findings.
- Remediation next steps.

Legal outputs:

- A `data` artifact shaped like `LicenseComplianceReport`.
- Classification decisions for blocking versus warning findings.
- Remediation next steps.

Decision Maker outputs:

- Approve, reject, or request changes, with rationale.
- Delegated next steps back to the Coordinator with constraints.

### Decision points

- Decision Maker: approve, reject, request changes, or accept documented risk.
- Coordinator: determine which optional agents are needed and whether scope must change.

### Quality, security, and legal gates

- QA must classify quality issues as blocking or non blocking.
- CISO must classify security and compliance findings as blocking or warning.
- Legal must classify license and notice findings as blocking or warning.
- Blocking findings must be resolved or explicitly accepted by the Decision Maker.
- Coordinator must aggregate PR Reviewer findings into the final run summary when PR Reviewer ran.

### Escalation points

- Any blocking QA, CISO, or Legal finding escalates to the Decision Maker.
- Any legal or compliance commitment escalates to a human maintainer when required (**TODO** define thresholds).

### Artifacts produced

- Technical Writer: documentation review report (data artifact, recommended).
- QA: test strategy report (data artifact, recommended).
- CISO: security and compliance report (data artifact).
- Legal: license compliance report (data artifact).
- Coordinator: final run summary in `runs/<run-id>/summary/final.md`.

## Flow B: Architecture or design change proposal

This flow is the canonical Orchestration definition for architecture and design change proposals. It extends the earlier flow by adding explicit QA gates and optional specialized reviews. For a full example run, see `docs/run-examples/architecture-change/README.md`.

Purpose: make design changes explicit, reviewable, and decision traceable, with clear ownership for tradeoffs.

### Trigger

- A proposal to change architecture, contracts, schemas, or repository layout.
- A conflict between existing documentation and an intended implementation direction.

### Participating agents

Mandatory:

- Coordinator
- Architect
- Tech Lead
- QA
- CISO
- Decision Maker

Optional (pulled in by scenario):

- DBA (data impact)
- DevOps (infra impact)
- Legal (license or dependency changes)
- Data Scientist (model or analytics impact)

### Ordered agent execution

1) Coordinator
2) Architect
3) Tech Lead
4) Optional specialists (DBA, DevOps, Data Scientist, Legal) as needed
5) QA
6) CISO
7) Decision Maker
8) Coordinator (final summary)

### Inputs per agent

Coordinator inputs:

- The proposal text and the affected areas (for example, `docs/agent-contract.md`, `schemas/`, `runs/`).
- Constraints (policy, compatibility requirements, versioning expectations).
- Any prior decisions that apply.

Architect inputs:

- Proposal scope, goals, and constraints.
- Prior decisions and compatibility expectations.

Tech Lead inputs:

- Proposed architecture direction and acceptance criteria.
- Constraints and sequencing expectations.

Optional specialist inputs:

- DBA: data model impact, query patterns, migration constraints.
- DevOps: operational impact, scaling and cost constraints, observability requirements.
- Data Scientist: data requirements, metrics, evaluation and experiment needs.
- Legal: licensing and notice impact if third party assets or distribution terms are affected.

QA inputs:

- Proposed changes and acceptance criteria.
- Risk areas and verification expectations.

CISO inputs:

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
- Final run summary in `runs/<run-id>/summary/final.md`.

Architect outputs:

- Architecture proposal and design decisions with rationale (data artifacts recommended).

Tech Lead outputs:

- Technical plan outline, risks, dependencies, and verification guidance (data artifact recommended).

Optional specialist outputs:

- DBA: database review report (data artifact recommended).
- DevOps: operations plan including scaling and cost notes (data artifact recommended).
- Data Scientist: analysis plan including data requirements and metrics (data artifact recommended).
- Legal: license compliance report when in scope (data artifact).

QA outputs:

- Quality gates and regression concerns, classified as blocking or non blocking (data artifact recommended).

CISO outputs:

- Findings with classification and recommended mitigations.

Decision Maker outputs:

- A recorded decision with rationale and scope.
- Delegation to Coordinator for execution planning and documentation updates.

### Decision points

- Decision Maker: selects an option or defers with explicit next steps and owners.
- Coordinator: determines whether the proposal is sufficiently specified to proceed or is blocked.

### Quality, security, and legal gates

- QA must classify quality issues as blocking or non blocking.
- CISO must classify security and compliance findings as blocking or warning.
- Legal must classify license and notice findings as blocking or warning when Legal is in scope.
- Blocking findings must be resolved or explicitly accepted by the Decision Maker.

### Escalation points

- Blocking CISO findings escalate to the Decision Maker and may require human risk acceptance.
- Any change that implies legal or licensing commitments escalates to a human maintainer (**TODO** define thresholds).

### Artifacts produced

- Coordinator: decision request (optional data artifact) and run summary (optional data artifact).
- Decision Maker: decision record (data artifact, optional) and delegated next steps.
- CISO: findings report (data artifact) when in scope.

## Flow C: Performance, reliability, or cost issue

This flow is the canonical Orchestration definition for issues where performance, reliability, or cost are primary drivers.

### Trigger

- A performance regression, reliability risk, incident pattern, or cost spike is reported.
- A proposal specifically targets scaling, reliability posture, or cloud resource costs.

### Participating agents

Mandatory:

- Coordinator
- DevOps
- DBA
- QA
- Decision Maker

Optional (pulled in by scenario):

- Architect (system level changes)
- Data Scientist (analysis, metrics, experiment design)
- CISO (if security or privacy relevant)
- Tech Lead (if implementation planning and sequencing is needed)

### Ordered agent execution

1) Coordinator
2) DevOps
3) DBA
4) Optional specialists (Architect, Data Scientist, CISO, Tech Lead) as needed
5) QA
6) Decision Maker
7) Coordinator (final summary)

### Inputs per agent

Coordinator inputs:

- Incident or issue description and any constraints.
- Affected artifacts or evidence references, if available.
- Run Policy constraints for logging and data handling.

DevOps inputs:

- Service objectives and constraints if known (**TODO**).
- Observability expectations and any existing telemetry constraints.
- Cost and scaling concerns in scope.

DBA inputs:

- Data access patterns, query patterns, and any migration context.
- Availability and rollback constraints if relevant.

Optional specialist inputs:

- Architect: proposed system changes and interface constraints.
- Data Scientist: metrics, analysis plan, and experiment design requirements.
- CISO: security and privacy implications for logging, data handling, or access patterns.
- Tech Lead: sequencing, risks, and implementation plan.

QA inputs:

- Acceptance criteria for the fix and regression surfaces.
- Any known failure modes and test expectations.

Decision Maker inputs:

- Options and tradeoffs, including cost and reliability impact.
- QA findings classified as blocking or non blocking.
- DBA and DevOps risks and constraints.

### Outputs per agent

DevOps outputs:

- Operations plan including monitoring requirements, scaling triggers, and cost optimization options (data artifact recommended).

DBA outputs:

- Data layer review including performance risks, migration notes, and rollback guidance when relevant (data artifact recommended).

QA outputs:

- Quality gates and regression plan, classified as blocking or non blocking (data artifact recommended).

Optional specialist outputs:

- Architect: design notes and compatibility impact.
- Data Scientist: analysis plan and metrics.
- CISO: security and privacy findings if in scope.
- Tech Lead: implementation plan and dependencies if in scope.

Decision Maker outputs:

- Approve, reject, or request changes, with rationale.
- Delegated next steps back to the Coordinator with constraints.

Coordinator outputs:

- Final run summary in `runs/<run-id>/summary/final.md`.

### Decision points

- Decision Maker: selects an option and approves tradeoffs or defers with owners.
- Coordinator: determines which optional agents are required based on impact.

### Quality, security, and legal gates

- QA must classify quality issues as blocking or non blocking.
- CISO is a gate only when security or privacy is implicated by the change.
- Blocking findings must be resolved or explicitly accepted by the Decision Maker.

### Escalation points

- Blocking QA findings escalate to the Decision Maker.
- Security relevant concerns escalate to CISO when in scope.
- Budget or cost commitments may require human maintainer approval (**TODO** define thresholds).

### Artifacts produced and run storage

- Agent outputs live under `runs/<run-id>/outputs/<agent>/result.json`.
- Produced files and diffs live under `runs/<run-id>/artifacts/`.
- The final aggregation lives under `runs/<run-id>/summary/final.md`.
