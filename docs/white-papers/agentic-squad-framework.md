# Agentic Squad Framework White Paper

## From Ad-Hoc AI Usage to Governed Agent Systems

**Version:** 1.0.1  
**Last updated:** 2026-01-17

> This white paper is published at:  
> https://merukimoon.com/en/thinking/white-papers/agentic-squad-framework
>
> This Markdown version is the canonical, version-controlled source used for collaboration, review, and iteration.

## Executive Summary

As AI agents become part of everyday engineering workflows, teams increasingly face a new class of problems: semantic drift, unclear responsibilities, fragile automation, and loss of shared context.

This paper introduces Agentic Squad Framework as a governance-first framework for agentic systems. This is not a library, SDK, or toolkit. It defines how agentic systems are structured, governed, and executed through explicit agent contracts and rule-based, deterministic validation and enforcement gates.

Instead of treating agents as isolated tools, the framework treats them as role-based participants in a system, governed by explicit contracts, terminology, and verification stages that are structured, validated, and enforced.

The goal is not more automation, but predictable, reviewable, and auditable collaboration between humans and agents.

This paper is for engineers and maintainers who need agent behavior to be reviewable and repeatable. Read it to understand the core roles, shared terminology, and verification boundaries that make multi-agent work operationally safe.

## What Makes This Framework Different

- Role-based agents, not prompt-centric helpers: responsibilities and boundaries come first, prompts follow.
- Terminology as a first-class system component: shared meaning is treated as infrastructure, not optional documentation.
- Verification as an explicit boundary: quality, security, and compliance gates are defined as part of the system, not left to ad-hoc review.
- A deterministic, rule-based engine as the source of truth: it validates schemas, enforces capability boundaries, evaluates verification feasibility, and either accepts, rejects, or falls back; it does not infer, reinterpret, repair, or improvise plans.

## 1. The Problem: AI Without Structure

Most teams start using AI agents organically:

- prompts live in chats or ad-hoc scripts
- terminology evolves implicitly
- responsibilities blur
- verification is manual or absent

At small scale, this feels productive.  
At team or organization scale, it becomes risky.

Typical failure modes include:

- the same term meaning different things in different prompts
- agents producing correct-looking but incompatible outputs
- reviewers unsure what an agent is actually responsible for
- automation that cannot be trusted or reused

The core issue is not model quality.  
It is lack of structure and governance.

## 2. A Different Mental Model: Agents as System Actors

Agentic Squad Framework starts from a simple shift:

AI agents are not tools.  
They are actors inside a system.

Just like human roles, agents require:

- a clear scope
- defined responsibilities
- shared language
- verification boundaries

Without these, scaling agent usage is indistinguishable from scaling chaos.

## 3. Core Principles

### 3.1 Explicit Roles Over Generic Agents

Each agent represents a role, not a capability bundle.

Examples:

- Architect
- Tech Lead
- PR Reviewer
- CISO
- Coordinator

A role answers one question clearly:  
What is this agent responsible for, and what is it not responsible for?

This immediately reduces overlap and ambiguity.

### 3.2 Canonical Terminology as Infrastructure

Language is treated as infrastructure, not documentation.

A canonical terminology glossary:

- defines shared meaning
- prevents semantic drift
- acts as a contract between agents and humans

Early stages use a Soft-Verify approach:

- glossary is canonical
- but subject to refinement
- changes are visible, not blocking

This allows evolution without losing coherence.

### 3.3 Prompts as Executable Contracts

Prompts are structured, not conversational.

The framework uses explicit prompt models to ensure that:

- intent is unambiguous
- scope is constrained
- outputs are reviewable

A prompt is treated as a declarative output contract, not an execution mechanism.

- Planning is performed by agents producing structured outputs.
- Execution authority always belongs to the engine.
- Enforcement is rule-based: the engine validates schema and constraints, enforces capability boundaries, evaluates verification feasibility, and then accepts, rejects, or falls back without reinterpretation or repair.

### 3.4 Verification Is a First-Class Concept

Verification is not an afterthought.

Every meaningful agent action defines:

- what "done" means
- how correctness is checked
- what happens when verification fails

The framework supports progressive rigor:

- Soft-Verify during exploration
- Strict Verify when systems stabilize

This mirrors how mature engineering systems evolve.

## System Overview

This diagram summarizes how the principles above combine into a single system.

```mermaid
flowchart TD
  A[Humans and Contributors] --> B[Canonical Terminology Glossary v0]

  B --> C[Agentic Squad]

  C --> D1[Architect]
  C --> D2[Tech Lead]
  C --> D3[Coordinator]
  C --> D4[PR Reviewer]
  C --> D5[CISO]

  D1 --> E[Structured Prompts]
  D2 --> E
  D3 --> E
  D4 --> E
  D5 --> E

  E --> F[Agent Outputs]

  F --> G{Verify}

  G -->|Soft Verify| H[Feedback and Notes]
  H --> E

  G -->|Strict Verify| I[Approved Change]
```

System overview  
Agentic Squad Framework treats language as shared infrastructure, agents as role-based actors, and verification as an explicit system boundary.

A canonical terminology glossary provides a single source of truth. Agents operate through structured prompts, producing reviewable outputs. Verification closes the loop, allowing systems to evolve safely from soft governance toward stricter enforcement as maturity increases.

## 4. From Ad-Hoc to Governed: A Progressive Path

Agentic Squad Framework does not require a big-bang adoption.

Typical progression:

1. Introduce role-based agents
2. Establish shared terminology
3. Use structured prompts
4. Add lightweight verification
5. Gradually enforce stricter gates where value justifies it

At every step, the system remains usable.

## 5. What This Is Not

To avoid confusion, the framework is not:

- a replacement for human decision-making
- a fully automated AI platform
- a rigid bureaucracy for prompts
- a model-specific solution

It is intentionally:

- model-agnostic
- tool-agnostic
- organization-friendly

The framework complements existing engineering practices rather than replacing them.

## 6. Why This Matters Now

As AI becomes embedded in delivery pipelines, architecture decisions, reviews, and security checks, teams face a choice:

- scale usage and accept growing risk
- or introduce governance that scales with them

Agentic Squad Framework is an attempt to offer a third option:  
scale AI usage with the same discipline used for human systems.

## 7. Intended Audience

This framework is designed for:

- engineering leaders
- architects
- tech leads
- teams experimenting with multi-agent workflows

Especially those who care about:

- predictability
- shared understanding
- long-term maintainability

## 8. Conclusion

AI agents are becoming collaborators.

Treating them as such requires:

- structure
- language
- contracts
- verification

Agentic Squad Framework provides a practical, incremental way to build agent systems that engineers can trust, reason about, and evolve.

The goal is not smarter agents.  
The goal is better systems.

## Practical Run Examples

This repository contains practical run examples that demonstrate the concepts and boundaries described in this paper in real scenarios.

See:

- docs/run-examples/architecture-change
- docs/run-examples/pr-completion

These examples focus on process, role boundaries, and verification, not just outputs. They are intended to make the system behavior observable, explainable, and reproducible.

## Status and Evolution

This white paper is v1 and describes stable principles, but some components are expected to evolve. In particular, terminology details and verification rigor may change over time as the repository matures and run examples expand.
