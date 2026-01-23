# Verify Flow

This document explains what **verify-flow** is, what it checks, and how it validates the product end-to-end.

`verify-flow` is a **product-level smoke flow**. It is not a test suite and not CI. Its purpose is to answer one question:

> **Does the core product flow work from zero to result?**

---

## What Verify Flow Is

Verify Flow validates that the main moving parts of the system are wired together correctly:

- Make targets
- CLI commands
- Run-based contract
- Planner
- Agent runtime
- Flow runtime

It executes a safe, deterministic scenario that mimics how a real user would interact with the system, while avoiding side effects.

---

## What Verify Flow Is Not

Verify Flow intentionally does **not**:

- Execute real plan steps
- Apply changes to the repository
- Replace unit or integration tests
- Validate business correctness of a plan

All agent and flow executions are performed in **dry-run mode**.

---

## High-Level Lifecycle

The verify-flow lifecycle follows this sequence:

```
create run
   ↓
write inputs
   ↓
run planner
   ↓
verify planner outputs
   ↓
run status
   ↓
run agent (dry-run)
   ↓
run flow (dry-run)
```

Each step validates a different layer of the product.

---

## Step-by-Step Breakdown

### Step 1. Create Run

A fresh run directory is scaffolded.

**What this validates**
- Run lifecycle is functional
- Run identifiers are generated correctly
- Base directory structure exists

**Failure means**
- Core project lifecycle is broken

---

### Step 2. Write Inputs

Two input files are written:

- `runs/<RUN>/inputs/request.md`
- `runs/<RUN>/inputs/context.md`

**What this validates**
- The run-first input contract is respected
- Planner can be driven purely from run inputs

**Failure means**
- Broken contract between orchestration logic and Planner

---

### Step 3. Run Planner

Command executed:

```
npm run dev -- planner --run <RUN>
```

**What this validates**
- Planner CLI wiring works
- LLM configuration is valid
- Planner output passes schema and safety validation

**Artifacts produced**
- `runs/<RUN>/outputs/planner/result.json`
- `runs/<RUN>/outputs/planner/notes.md`

**Failure means**
- Planner, schema, safety gates, or LLM integration is broken

---

### Step 4. Verify Planner Outputs

The flow explicitly checks that planner outputs exist.

**What this validates**
- Planner produced real, persisted results
- Output paths are correct

**Failure means**
- Planner executed but did not write expected artifacts

---

### Step 5. Run Status

Command executed:

```
npm run dev -- status --run <RUN>
```

**What this validates**
- Status command understands the run state
- CLI status does not crash on a valid run

**Important**
- Status is executed **after** Planner, not before

**Failure means**
- Status logic is inconsistent with run lifecycle

---

### Step 6. Run Agent (Dry-Run)

Command executed:

```
npm run dev -- agent coordinator --run <RUN> --dry-run
```

**What this validates**
- Agent runtime initializes correctly
- Agent CLI wiring works
- Dry-run mode behaves safely

**Failure means**
- Agent execution path is broken

---

### Step 7. Run Flow (Dry-Run)

Command executed:

```
npm run dev -- flow --run <RUN> --dry-run
```

**What this validates**
- Plan can be interpreted as a flow
- Step dependencies are coherent
- Flow runtime is operational

**Failure means**
- Flow execution logic is broken

---

## Why This Order Matters

Verify Flow only checks **valid system states**:

- A freshly scaffolded run may not be valid for `status`
- Planner establishes the first meaningful state
- All subsequent checks depend on planner outputs

This avoids false negatives and keeps the flow deterministic.

---

## How to Run Verify Flow

From the repository root:

```
make verify-flow
```

A successful run:
- Creates a new run
- Produces planner outputs
- Completes all dry-run steps
- Exits with code 0

---

## Summary

Verify Flow is the **canonical product smoke flow**.

It validates that:

```
run → inputs → planner → outputs → status → agent → flow
```

work together as a single product.

If verify-flow is green, the product wiring is healthy.
