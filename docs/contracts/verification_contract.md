# Verification Contract

## 1) Purpose
- Define the canonical verification pipeline and outcomes.
- Make verification responsibilities, inputs, and results deterministic.

## 2) Definitions
- **Verification**: Read-only checks that ensure runs and artifacts meet contracts.
- **Validation**: Synonym in this repo for verification commands.
- **Pass/Fail**: Binary result of a verification stage.
- **Verdict**: Exit code and console output produced by the verification command.

## 3) Canonical Verification Pipeline
- Commands:
  - `make verify`: runs typecheck, ESM checks, and tests.
  - `make verify-plan-e2e GOAL="..." CONTEXT="..."`: creates a run, executes planner, runs verification gates (typecheck, ESM, tests), runs `verify-flow`, `orchestrator-validate`, and validates runs.
- Stages and responsibilities:
  - Typecheck (`tsc`): validate TypeScript types.
  - ESM verification: enforce ESM import rules.
  - Tests (`vitest run`): execute unit/integration tests.
  - `verify-flow`: scaffold a run, execute planner/coordinator/review steps, and generate artifacts.
  - `validate-run`/`verify-run`: confirm run artifacts match contracts (layout, references, statuses).
  - `orchestrator-validate`: run orchestrator flow (planner+architect) and validate resulting run with immutability checks.

## 4) Binary Outcomes
- Pass criteria: command exits 0; required artifacts exist and match contracts; no schema/consistency errors reported.
- Fail criteria: non-zero exit code; missing or inconsistent artifacts; contract violations emitted by validators or tests.
- Exit code semantics (observed): `0` = success; `>0` = failure; `2` may be used by flows for gated/blocked states but verification commands report failure when exit is non-zero.
- Verdict visibility: stdout/stderr from make targets and underlying scripts; exit code to CI/local shell; run directories remain for inspection.
- Enforced hard constraints (current): presence of inputs/request.md and inputs/context.md (R1); finished runs require plan.json, summary/final.md, per-step outputs and steps artifacts, and valid run.json status/exit_code (R2/R3/R4/R5/R8 from rules_model).
- Status command exit codes: exits 0 when run directory exists and status renders; exits non-zero when run directory is missing or unreadable.

## 5) Agent vs Verification Boundary
- Agent obligations: produce required outputs (`result.json`, `notes.md`, optional `status.json`), respect agent contract and failure protocol, avoid falsifying run state.
- Verification obligations: read artifacts without mutation; check presence/shape/consistency per run lifecycle and artifacts contracts; do not assume agent intent beyond artifacts.
- Forbidden assumptions: verification must not “fix” artifacts, infer missing data, or ignore hard constraint failures.

## 6) Soft Rules vs Hard Constraints in Verification
- Soft rule handling: if a soft rule is violated, annotate in `outputs/<agent>/notes.md` with rule ID and rationale; verification may surface warnings in future but does not fail today.
- Hard constraints: missing required artifacts, invalid statuses, or falsified state must fail verification (`validate-run`/`verify-run` or upstream stages).

## 7) Relationship to Run Lifecycle and Finished Criteria
- Verification checks that finished runs meet lifecycle criteria: terminal status (`done`/`failed`), exit codes set, summary present, plan present, steps index and outputs present for executed steps.
- Runs lacking finished criteria are treated as incomplete and should fail finished-run checks.

## 8) Golden Path Alignment
- Golden Path v0 uses `make verify-flow` followed by `make validate-run`; `make verify-plan-e2e` executes the same components plus planner orchestration and validations, producing passing artifacts consistent with this contract.

## 9) Non-Goals
- No new schemas or tooling.
- No enforcement of future policy gates beyond existing commands.
- No CI policy changes defined here.
