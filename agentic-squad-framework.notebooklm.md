# Agentic Squad Framework (NotebookLM Standalone)

## What this is

Agentic Squad Framework is a practical methodology for running multi agent work in engineering teams with explicit roles, shared terminology, and visible verification. It is designed to make agent outputs reviewable, repeatable, and safe to depend on.

This approach is intentionally implementation agnostic. It can be used before a runtime exists and can remain useful after automation is introduced.

## Core idea

Ad hoc agent usage tends to break at team scale for reasons unrelated to model capability:

- Semantic drift: the same term means different things across prompts and people.
- Blurred ownership: it is unclear which agent is responsible for what, so work overlaps or gaps appear.
- Fragile outputs: responses are hard to parse, compare, or reuse.
- Implicit verification: reviewers cannot tell what was actually checked versus what was assumed.

Agentic Squad Framework treats agent work as a system:

- Agents are role based actors with bounded responsibilities.
- A canonical terminology glossary stabilizes meaning.
- A contract defines how inputs and outputs are structured.
- Verification is an explicit boundary with clear gates and a single approver.

The goal is not maximum automation. The goal is predictable collaboration between humans and agents.

## How to use this in real teams

Start with one workflow and keep it manual until the team trusts the structure.

### A minimal adoption path

1. Pick a scenario the team already does (for example PR review, design review, incident follow up).
2. Define which roles are mandatory and which are optional for that scenario.
3. Create a run record for one attempt and capture inputs, context, outputs, artifacts, and a final summary.
4. Require structured outputs from each participating agent.
5. Make verification explicit: quality, security, and legal checks are recorded and classified.
6. Record approval decisions in one place and assign follow ups with owners.

### The run concept in practice

A run is one attempt to complete a task using a set of agents under a shared policy. A run is designed to be inspectable:

- Inputs: what the task is and what context was used.
- Outputs: what each role produced, including decisions and next steps.
- Artifacts: any reusable output (reports, notes, diffs, files) referenced from agent outputs.
- Summary: a single final aggregation that states outcome, decisions, and follow ups.

The run format can be implemented as a folder layout or any other storage. The key requirement is that a third party can reconstruct what happened from the recorded inputs and outputs.

## Roles and responsibilities

The framework separates work by role to make boundaries enforceable and to reduce hidden assumptions.

### Core orchestration roles

Coordinator

- Responsibility: routes work, sequences the flow, collects outputs, and publishes the final run summary.
- Boundary: does not make final decisions on tradeoffs or risk acceptance.

Decision Maker

- Responsibility: approves, rejects, or requests changes; resolves conflicts; explicitly accepts risk when needed.
- Boundary: does not do large implementation or extensive review work. It decides and delegates.

### Verification and review roles

PR Reviewer

- Responsibility: reviews diffs and change intent at the PR level; identifies correctness and maintainability concerns; classifies findings as blocking or non blocking; escalates security and license concerns to the appropriate roles.
- Boundary: does not approve merges or rewrite large portions of code.

QA

- Responsibility: defines test strategy and quality gates; identifies regression risk; classifies findings as blocking or non blocking.
- Boundary: does not write production code.

CISO

- Responsibility: reviews security, privacy, and compliance implications for the change set; classifies findings as blocking or warning.
- Boundary: does not do legal licensing analysis; does not approve outcomes.

Legal (license and compliance)

- Responsibility: assesses license compatibility and notice obligations for changes such as dependencies, third party text, or distribution terms; classifies findings as blocking or warning.
- Boundary: does not duplicate security review; does not approve outcomes.

Technical Writer

- Responsibility: validates documentation accuracy, consistency, and terminology; proposes concrete documentation fixes and clarifications.
- Boundary: does not define product decisions or approve tradeoffs.

### Specialist roles pulled in by scenario

Architect

- Responsibility: evaluates architecture options, boundaries, compatibility impact, and migration notes; records tradeoffs and design decisions.
- Boundary: does not own final approvals or delivery coordination.

Tech Lead

- Responsibility: translates goals into an implementable plan, sequencing, risks, and dependencies; provides estimates at an appropriate level.
- Boundary: does not make final product decisions; escalates tradeoffs.

DBA

- Responsibility: reviews data layer impact, migrations, indexes, and performance implications; provides rollback guidance.
- Boundary: stays scoped to data layer concerns.

DevOps or SRE

- Responsibility: reviews operational impact, observability, reliability, scaling, and cost considerations; proposes operational requirements and risks.
- Boundary: does not own product architecture decisions; provides constraints and recommendations.

Data Scientist

- Responsibility: proposes metrics, analysis approaches, and experiment designs for analytics or model related changes; clarifies data requirements and evaluation criteria.
- Boundary: does not own productionization; hands off to engineering roles.

## Language and terminology

Terminology is treated as infrastructure. The goal is to keep meaning stable across agents, prompts, and reviews.

### Soft Verify terminology discipline (v0)

Soft Verify for terminology is a lightweight rule:

- If a term appears in documentation, prompts, or agent definitions, it should be defined in the glossary or use an existing defined term.
- Glossary changes are encouraged and tracked in the changelog, but they do not block development, reviews, or runs.

This makes drift visible early without turning language into bureaucracy.

### Canonical glossary (condensed)

Agent

- Definition: a bounded unit of behavior that consumes a task request, context, and policy and emits a structured response.
- Not: a human contributor or an unstructured chatbot.

Squad

- Definition: a set of agents coordinated to complete a task under a shared policy.
- Not: a fixed roster that always runs.

Task

- Definition: a bounded unit of work with a goal and acceptance criteria.
- Not: an open ended project without defined outcomes.

TaskRequest

- Definition: the structured description of a task (goal, inputs, acceptance criteria, identifiers).
- Not: free form chat without constraints.

Context

- Definition: supporting information and references provided to agents; treated as untrusted input.
- Not: a policy or a guarantee of correctness.

Policy

- Definition: constraints for a run, including allowed tools, forbidden actions, privacy, budgets, and logging requirements.
- Not: a prompt or the contract itself.

Agent Contract

- Definition: the canonical input and output structure and behavior rules agents must follow (statuses, errors, artifacts, and invariants).
- Not: a per agent policy or a prompt.

Prompt

- Definition: versioned instructions used to shape agent behavior; prompts should separate stable role framing from variable task inputs.
- Not: a guarantee of compliance with policy or contract.

Artifact

- Definition: a reusable output such as a file, diff, structured data, or a reference; artifacts are explicitly listed in agent outputs.
- Not: unstructured logs or vague notes.

Run

- Definition: one execution attempt of a task by a squad under a policy, with recorded inputs, outputs, artifacts, and a final summary.
- Not: a single agent message without traceable context.

Flow (orchestration)

- Definition: a deterministic sequence of participating roles, inputs, outputs, decision points, and verification gates for a scenario.
- Not: ad hoc collaboration without a recorded order and outcome.

Verification

- Definition: explicit checks that confirm outputs meet acceptance criteria and policy, including quality, security, and legal gates plus approval.
- Not: an implied claim that something was checked.

Blocking vs non blocking vs warning

- Blocking: prevents progression until resolved or explicitly accepted by the Decision Maker.
- Non blocking: may proceed if recorded and owned.
- Warning: used by security and legal roles as a non blocking classification that still requires visibility and ownership.

## Verification and trust

Verification is a first class boundary. It is made visible through structured outputs and explicit classifications.

### The Agent Contract (conceptual)

Agents behave as if they receive three inputs:

- TaskRequest: what to do and what “done” means.
- Context: supporting information and prior outputs.
- Policy: constraints, including tool and privacy boundaries.

Agents produce a machine consumable response envelope with:

- Identifiers: contract version, run id, task id, agent identity.
- Status: ok, blocked, or error.
- Summary: short human readable outcome.
- Decisions: recorded choices with rationale.
- Next steps: actionable items with owners.
- Artifacts: reusable outputs with safe paths or references.
- Errors: required when blocked or error.
- Logs: optional and policy dependent.

### Status and escalation

ok

- Meaning: completed within policy constraints to the best of the agent’s ability.

blocked

- Meaning: cannot proceed without new input, permissions, or missing dependencies.
- Requirement: include at least one explicit next step stating what is needed.

error

- Meaning: failed due to invalid inputs, tool failures, or internal failure.
- Requirement: include an error record and safe recovery steps when possible.

### Invariants that preserve trust

- Policy compliance: do not perform forbidden actions and do not claim to have done so.
- Tool honesty: do not invent tool outputs.
- Traceability: outcome affecting choices appear as explicit decisions.
- Path safety: artifacts use repo relative safe paths, never absolute paths or path traversal.
- Data minimization: do not leak secrets or sensitive data; keep outputs small and redacted.

### Conformance levels (gradual adoption)

L0 (minimum)

- Emit a complete response envelope with correct status and errors.
- Respect policy boundaries.

L1 (artifacts)

- Include artifacts in a structured way (file, diff, data, reference) so a coordinator can apply or store them.

L2 (structured logs)

- Add structured logs when policy requires, sufficient to reconstruct decisions and tool calls without leaking sensitive inputs.

## Practical scenarios (at least one concrete end to end example)

This section describes three common scenarios and then walks through one complete run example.

### Scenario A: PR completion and review

Purpose: decide whether a PR is ready to merge with explicit review, quality, security, and legal gates plus an explicit approval decision.

Typical mandatory roles:

- Coordinator
- PR Reviewer (required for code or configuration changes; optional for docs only)
- Technical Writer
- QA
- CISO
- Legal
- Decision Maker

Optional roles by impact:

- Tech Lead for technical planning and sequencing
- DevOps for operational impact
- DBA for data impact

### Scenario B: architecture or design change proposal

Purpose: choose among architecture options with explicit tradeoffs and an explicit approval decision.

Typical mandatory roles:

- Coordinator
- Architect
- Tech Lead
- QA
- CISO
- Decision Maker

Optional roles by impact:

- DBA for data impact
- DevOps for infra or reliability impact
- Data Scientist for analytics or model impact
- Legal when licensing or dependency terms change

### Scenario C: performance, reliability, or cost issue

Purpose: decide on remediation options with explicit operational and data layer review plus approval.

Typical mandatory roles:

- Coordinator
- DevOps
- DBA
- QA
- Decision Maker

Optional roles by impact:

- Architect for system level changes
- Data Scientist for metrics and analysis
- CISO when privacy or security is implicated
- Tech Lead when implementation planning is needed

### Concrete end to end example: PR completion and review

Initial situation

- A PR changes user facing documentation and a configuration default (a feature flag).
- The goal is to decide whether the PR is correct, compliant, and ready to merge.
- The policy constraints include data minimization and manual review boundaries.

Why this is non trivial

- Documentation and configuration changes can create user confusion and operational risk even without code changes.
- Multiple verification lenses are required: PR quality review, documentation clarity, quality gates, security and compliance, and license and notice obligations.
- Risk acceptance must be explicit, not implied.

Run inputs (condensed)

Task request

- Title: review a PR for docs and config update.
- Goal: ready to merge and compliant.
- Acceptance criteria (examples):
  - Documentation is accurate and consistent.
  - Feature flag default and rollout plan are documented.
  - Quality gates cover changed behavior.
  - No blocking security or license issues.
- Constraints (examples):
  - Do not copy secrets.
  - Avoid storing proprietary code in artifacts.
  - Manual review only unless tools are explicitly allowed.

Context

- PR link or equivalent change identifier.
- Diff summary describing what changed.
- Repository state information (branch, key paths changed).
- References used during review (architecture notes, flow definitions, contract rules).

Chronological execution with role boundaries

Step 1: Coordinator frames the run

- Inputs: task request, context, and policy.
- Output: a routing decision and a list of required checks and participating roles.
- Key constraint: policy and acceptance criteria are made explicit up front.

Step 2: PR Reviewer performs diff level review

- Inputs: PR link and diff summary plus any relevant design context.
- Output: a PR review report artifact and a structured set of findings.
- Key decision: record a non blocking improvement and delegate it rather than attempting to approve or patch the PR.

Example of a minimal PR Reviewer output (condensed)

```text
status: ok
summary: No blocking issues; minor clarity improvement suggested.
decisions: [ flag default doc alignment is acceptable ]
next_steps: [ add one line comment clarifying rollout plan ]
artifacts: [ PR review report with findings and risk ]
```

Step 3: Technical Writer validates documentation

- Inputs: changed doc paths and intended audience signals plus canonical terminology.
- Output: documentation review notes and concrete copy edits or link fixes.
- Key constraint: focus on clarity and consistency, not approval.

Step 4: QA defines quality gates

- Inputs: acceptance criteria and the change scope.
- Output: a test strategy summary and any required quality gates.
- Key decision: classify any issues as blocking or non blocking and assign owners for follow ups.

Step 5: CISO performs the security and compliance gate

- Inputs: scope of change and any relevant policy constraints.
- Output: a security and compliance report with classification.
- Key constraint: the review is scoped to evidence; do not assume new data flows or permissions without proof.

Step 6: Legal performs the license and notice gate

- Inputs: licensing context and whether dependencies or third party content changed.
- Output: a license compliance report with classification.
- Key constraint: keep legal and security concerns separate so neither is diluted.

Step 7: Decision Maker approves with conditions

- Inputs: aggregated findings and any remaining tradeoffs.
- Output: an explicit approval, rejection, or request changes decision with rationale.
- Key rule: all blocking findings must be resolved or explicitly accepted; non blocking items can proceed but must be recorded with owners.

Step 8: Coordinator publishes the final summary

- Inputs: all agent outputs and artifact references.
- Output: a final run summary that captures outcome, key decisions, artifacts, and follow ups.
- Key rule: a final summary exists even if the run is blocked or partial.

Soft Verify points in this example

- The PR Reviewer, Technical Writer, QA, CISO, and Legal roles each produce explicit outputs that make checks visible.
- Classifications and follow ups make it clear what was checked and what remains.
- Approval is recorded by a single decision authority.

What would likely go wrong with one generic agent

- Boundaries collapse: review, security, legal, and approval concerns are mixed and difficult to audit.
- Assumptions become hidden: policy constraints and acceptance criteria are not consistently recorded.
- Verification becomes narrative: it is unclear what was checked versus inferred.
- Approval becomes ambiguous: risk acceptance may be implied rather than explicitly recorded.

## What this is not

This framework is not:

- A fully automated AI platform.
- A replacement for human decision making.
- A model specific or language specific runtime.
- A prompt collection without governance.
- A hard enforcement system at early stages; Soft Verify is intentionally non blocking.

## Open questions and future directions

This repository intentionally keeps some items open until a runtime exists and teams gain operational experience:

- How strict verification gates should be introduced beyond Soft Verify and when they justify their cost.
- How prompt versions should be referenced and stored so runs remain reproducible.
- How schemas for structured inputs and outputs should be formalized and validated.
- What compatibility means for prompts, schemas, and on disk run formats once implementation begins.
- What minimal automation should exist for creating runs and capturing structured outputs without imposing a language choice.
