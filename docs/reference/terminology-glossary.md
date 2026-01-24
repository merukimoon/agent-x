# Terminology Glossary (Canonical, v0)

This glossary is the single source of truth for naming across the Agentic Squad Framework. Terms are implementation-agnostic and apply to agents, prompts, runs, and documentation. Version: v0 (canonical but subject to refinement; keep changes tracked in `CHANGELOG.md`).

## Agent

Definition: A bounded unit of behavior that consumes a TaskRequest, Context, and Policy and emits a structured response aligned to the Agent Contract. An agent is defined by its instructions, responsibilities, and allowed actions.  
Not: A human contributor or an unstructured chatbot; not necessarily tied to a specific runtime or model.

## Agent Contract

Definition: The canonical schema and rules an agent must follow when producing outputs (fields, statuses, artifacts, errors, logs). Located at `docs/agent-contract.md`.  
Not: A per-agent policy or prompt; not optional guidance.

## Agentic Squad Framework

Definition: The project and repository that host agent specifications, orchestration definitions, prompts, schemas, and run scaffolding. Short name: AgentSquad.  
Not: A deployed service or language-specific SDK (implementation is **TODO**).

## Squad

Definition: A set of agents coordinated to complete a task under shared Policy. Composition depends on the flow and scenario.  
Not: A team of humans or an always-on fixed roster.

## Coordinator

Definition: The agent that owns routing, sequencing, aggregation, and final run summary. It never owns final approvals.  
Not: The Decision Maker.

## Decision Maker

Definition: The single authority for approvals, rejections, and risk acceptance within a run.  
Not: An executor or implementer.

## Specialized agents

Definition: Domain-specific agents pulled into flows as needed: Architect, Tech Lead, DBA, DevOps, Data Scientist, QA, Technical Writer, Legal, CISO, PR Reviewer, and others defined under `domain/agents/`.  
Not: General-purpose executors; they stay within their documented scope and policies.

## Task

Definition: A bounded unit of work described by a TaskRequest with goal, scope, and acceptance criteria.  
Not: An open-ended project or backlog item without defined outcomes.

## TaskRequest

Definition: The structured description of a Task provided to agents (goal, inputs, acceptance criteria, identifiers).  
Not: Free-form chat without constraints.

## Context

Definition: Supporting information provided to agents (artifacts, references, environment notes). Treated as untrusted input.  
Not: A policy or instruction; not guaranteed to be complete or safe.

## Policy

Definition: Constraints for a run (allowed tools, forbidden actions, privacy, budgets, logging).  
Not: The Agent Contract; not a prompt.

## Prompt

Definition: Versioned instructions/templates given to agents to shape behavior. Stored under `prompts/`.  
Not: The Agent Contract or policy; not a guarantee of compliance.

## Run

Definition: One execution attempt of a task by a squad under a specific policy. Identified by `run_id`; stores inputs, outputs, artifacts, and summary under `runs/<run-id>/`.  
Not: A generic log dump or a single agent call.

## Run summary

Definition: The final Coordinator aggregation for a run, recorded in `summary/final.md` and referenced from agent outputs.  
Not: A raw agent transcript.

## Artifact

Definition: A produced output intended for reuse (file, diff, data, reference) emitted via the Agent Contract artifact schema. Stored or referenced under `artifacts/`.  
Not: Arbitrary logs or unstructured notes.

## Flow (Orchestration)

Definition: A deterministic sequence of agent participation, inputs, outputs, decisions, and gates for a scenario (see `docs/flows.md`).  
Not: Ad-hoc ordering or informal collaboration.

## Blocking vs non blocking

Definition: Finding classification used by QA and PR Reviewer (blocking) and CISO/Legal (blocking or warning). Blocking must be resolved or explicitly accepted by the Decision Maker; non blocking and warning may proceed with follow-ups.  
Not: Severity labels without clear action.

## Decision

Definition: A recorded choice in an agent response (`decisions[]`), including rationale and scope when relevant.  
Not: An implicit assumption or unstated preference.

## Next step

Definition: A concrete, actionable item (`next_steps[]`) with an owner and reason, derived from agent outputs.  
Not: Vague suggestions without ownership.

## Orchestration

Definition: The explicit, inspectable coordination of agents, flows, and policies to complete a run. Coordinator owns orchestration; Decision Maker owns approvals.  
Not: Implicit collaboration or versioned labels like “Orchestration v2”.

## RACI-PV

Definition: Prompt shorthand describing role framing used in tasks (Role, Action, Context, Input, Verification).  
Not: A process framework for approvals or staffing.

## Verification

Definition: Activities that confirm outputs meet acceptance criteria, policy, and flow gates (QA checks, CISO review, Legal review, Decision Maker approval).  
Not: A single test case or informal read-through.

## Checklist

Definition: A structured list of required actions or validations per agent (see `domain/agents/*/checklists.md`).  
Not: Optional suggestions.

## Acceptance criteria

Definition: Specific, testable conditions that define “done” for a task. Provided in TaskRequest and used by QA and Decision Maker to judge completion.  
Not: General goals or aspirations.

## Blocking issue

Definition: A finding that prevents progression until resolved or explicitly accepted by the Decision Maker (e.g., QA blocker, CISO blocking finding, Legal blocking issue).  
Not: A warning or improvement note.

## Warning / non blocking issue

Definition: A finding that can proceed if recorded and owned (CISO/Legal warnings; QA/PR Reviewer non blocking items).  
Not: An ignorable note; must have owners or follow-ups.

## Contributor

Definition: Any person submitting issues, PRs, or feedback to the repository.  
Not: An agent; agents follow the contract but are not repository contributors.

## Maintainer

Definition: Person with merge/release rights responsible for approvals, governance, and resolving escalations.  
Not: Automatically any Decision Maker agent; human role only.

## Prompt framework references

Definition: Named prompt patterns used in docs (e.g., RACI-PV, CLEAR-XA if present) that shape task framing and execution guidance.  
Not: Formal governance processes; they guide instructions only.
