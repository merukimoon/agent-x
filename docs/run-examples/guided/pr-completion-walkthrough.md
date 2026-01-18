# Guided Run Example: PR Completion and Review

## Scenario Overview

A pull request updates user-facing documentation and changes a configuration default (a new feature flag). The goal is to decide whether the change is ready to merge while keeping responsibilities explicit, outputs reviewable, and verification steps visible.

This scenario is non-trivial because it combines multiple concerns. Documentation accuracy, configuration impact, quality gates, and security and license checks must all be assessed, and any remaining risk must be owned by an explicit approver.

Related context:

- White paper (conceptual model and verification): [`../../white-papers/agentic-squad-framework.md`](../../white-papers/agentic-squad-framework.md)
- Flow definition (Flow A): [`../../flows.md`](../../flows.md)
- Run example source of truth: [`../pr-completion/README.md`](../pr-completion/README.md)

## Participating Roles

This walkthrough follows the PR completion run example with these roles:

- Coordinator: routes the work, collects context, sequences the flow, and produces the final run summary.
- PR Reviewer: reviews the PR change set at the PR and diff level and emits a PR review report with blocking vs non blocking findings.
- Technical Writer: checks documentation accuracy and consistency and proposes concrete doc fixes.
- QA: defines quality gates and classifies quality findings as blocking vs non blocking.
- CISO: performs a security and compliance review and classifies findings as blocking vs warning.
- Legal: performs a license and notice review and classifies findings as blocking vs warning.
- Decision Maker: approves, rejects, or requests changes, and records rationale and accepted risks.

## Step-by-Step Walkthrough

The source-of-truth inputs and outputs below come from the run example templates under `docs/run-examples/pr-completion/templates/`.

### Step 1: Coordinator ingests and frames the run

- Role: Coordinator
- Input received:
  - TaskRequest template: `../pr-completion/templates/inputs/request.md`
  - Context template: `../pr-completion/templates/inputs/context.md`
- Output produced:
  - A coordination envelope aligned to the Agent Contract (conceptually captured in `outputs/coordinator/result.json`).
- Decision or constraint that mattered:
  - The run Policy constraints in the request template are explicit about privacy and tool boundaries (manual review only, do not copy secrets).

### Step 2: PR Reviewer reviews the change set and classifies findings

- Role: PR Reviewer
- Input received:
  - PR link and diff summary from the TaskRequest and Context.
  - References to architecture, flows, and the Agent Contract.
- Output produced:
  - `../pr-completion/templates/outputs/pr-reviewer/result.json`
  - A PR review report artifact referenced inside that response as `artifacts/pr-review-report.txt`.
- Decision or constraint that mattered:
  - The PR Reviewer recorded a non blocking suggestion and delegated it to the Coordinator, rather than attempting to approve or patch the PR directly.

### Step 3: Technical Writer validates docs against canonical references

- Role: Technical Writer
- Input received:
  - The changed doc paths and intended audience signals from Context.
  - Canonical references such as `docs/flows.md` and `docs/architecture.md` (linked in the Context template).
- Output produced:
  - `../pr-completion/templates/outputs/technical-writer/result.json`
  - Documentation review notes artifact referenced as `artifacts/doc-review-notes.txt`.
- Decision or constraint that mattered:
  - The Technical Writer focused on terminology and linkage consistency, not on product or rollout approval.

### Step 4: QA defines quality gates and checks regression risk

- Role: QA
- Input received:
  - Acceptance criteria from the TaskRequest.
  - PR Reviewer and Technical Writer outputs as context for what to verify.
- Output produced:
  - `../pr-completion/templates/outputs/qa/result.json`
  - Test strategy artifact referenced as `artifacts/qa-test-strategy.txt`.
- Decision or constraint that mattered:
  - QA outputs are expected to classify issues as blocking vs non blocking; here the result is “ok” with follow-up verification steps delegated to the Coordinator.

### Step 5: CISO performs the security and compliance gate

- Role: CISO
- Input received:
  - The defined scope (docs and config default) and any relevant policy constraints.
  - The PR context indicating no dependency changes.
- Output produced:
  - `../pr-completion/templates/outputs/ciso/result.json`
  - Security and compliance report artifact referenced as `artifacts/security-compliance-report.txt`.
- Decision or constraint that mattered:
  - This review is scoped to what changed; it does not assume new data flows or permissions without evidence.

### Step 6: Legal performs the license and notice gate

- Role: Legal
- Input received:
  - License context and the PR scope, including whether dependencies changed.
- Output produced:
  - `../pr-completion/templates/outputs/legal/result.json`
  - License compliance report artifact referenced as `artifacts/license-compliance-report.txt`.
- Decision or constraint that mattered:
  - Legal is separate from security; it focuses on licensing and notices, and here it records no impacts.

### Step 7: Decision Maker approves with conditions

- Role: Decision Maker
- Input received:
  - Aggregated findings and remaining tradeoffs, including classifications from QA, CISO, Legal, and PR Reviewer.
- Output produced:
  - `../pr-completion/templates/outputs/decision-maker/result.json`
- Decision or constraint that mattered:
  - Approval is explicit and conditional: a non blocking improvement is allowed to proceed but is still recorded as a required follow-up in `next_steps[]`.

### Step 8: Coordinator aggregates and publishes the final run outcome

- Role: Coordinator
- Input received:
  - All agent outputs plus references to artifacts.
- Output produced:
  - `../pr-completion/templates/outputs/coordinator/result.json`
  - Final aggregation example: `../pr-completion/templates/summary/final.md`
- Decision or constraint that mattered:
  - The Coordinator’s responsibility is to make outcomes inspectable, including making sure artifact references are consistent across agent outputs and the final summary.

## Verification Points

Soft Verify in this run is visible as explicit, recorded checks rather than automated enforcement:

- PR Reviewer check: confirms the change set is understandable, low risk, and correctly scoped; produces a structured report and flags follow-ups.
- Technical Writer check: validates terminology and references against canonical docs; produces a concrete notes artifact.
- QA check: verifies acceptance criteria coverage and identifies where regressions could occur; produces a test strategy artifact and assigns follow-ups.
- CISO gate: verifies the change does not introduce new data handling or permissions; produces a security report artifact.
- Legal gate: verifies no licensing or notice impacts given no dependency changes; produces a license report artifact.
- Decision Maker approval: records whether blocking findings exist and whether any risk is accepted or deferred.

What would trigger a fix or iteration:

- Any blocking finding from QA, CISO, or Legal.
- Missing or conflicting context (for example, unclear rollout plan, unclear scope, or unknown dependency impact).
- Inconsistent artifact references across outputs (for example, if an artifact is referenced but not produced, or file paths differ between agent outputs and the final summary).

## Single Agent Comparison

If a single generic agent attempted to handle this entire run end to end, likely failure modes include:

- Collapsed boundaries: review, security, legal, and approval concerns get mixed into one output without clear ownership.
- Hidden assumptions: scope and constraints (privacy, allowed tools, policy boundaries) may be applied inconsistently or not recorded.
- Weak verification: checks become implicit and non-auditable, making it hard for maintainers to know what was actually reviewed and what was guessed.
- Unclear decision authority: approvals and risk acceptance may be implied rather than recorded by a dedicated Decision Maker role.

## Key Takeaways

- The run demonstrates role-based separation of concerns with explicit gates and an explicit approver.
- Outputs are structured so findings, decisions, and follow-ups can be inspected and traced across the run.
- Soft Verify works by making checks and classifications visible and repeatable, even when enforcement is manual.
