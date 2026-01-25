# Golden Path v0

## Purpose
- Provide one minimal, repeatable scenario that proves AgentX works end-to-end.
- Remove ambiguity about how to go from request to verified artifacts.

## Scope
- Included: one goal, planner to coordinator to approvals, and run validation using built-in tooling.
- Included: deterministic inputs created by `make verify-flow`.
- Excluded: custom goals, external tools, human overrides, multi-squad variants, or productization.

## Scenario Definition
- Goal: Prove the repository can plan, execute, and validate a simple verification request.
- Agents: Planner, Coordinator, Decision Maker, PR Reviewer (CISO is present but skipped in this path).
- Inputs: A fresh run created by `make verify-flow` with `inputs/request.md` containing the verification goal and `inputs/context.md` containing minimal context.

## Execution Flow
1) Scaffold run  
   - Responsible: Operator  
   - Input: Command `make verify-flow` (creates run, request, context)  
   - Output: `run.json`, `inputs/request.md`, `inputs/context.md`  
   - Artifact: `runs/<RUN>/run.json`, `runs/<RUN>/inputs/*.md`
2) Plan  
   - Responsible: Planner  
   - Input: Request and context files  
   - Output: Plan covering planner-only flow for the sample goal  
   - Artifact: `runs/<RUN>/outputs/planner/{result.json,notes.md,status.json}`
3) Coordinate  
   - Responsible: Coordinator (dry-run)  
   - Input: Planner result and run inputs  
   - Output: Coordinator contract response confirming routing and dependencies  
   - Artifact: `runs/<RUN>/outputs/coordinator/{result.json,notes.md,status.json}`
4) Execute flow  
   - Responsible: Decision Maker then PR Reviewer (CISO step is skipped)  
   - Input: Planner result, coordinator context, and run inputs  
   - Output: Contract responses per agent with statuses and any notes  
   - Artifact: `runs/<RUN>/outputs/decision-maker/*`, `runs/<RUN>/outputs/pr-reviewer/*`, `runs/<RUN>/steps/index.json`
5) Summarize  
   - Responsible: Coordinator  
   - Input: All agent outputs  
   - Output: Final summary and roll-up  
   - Artifact: `runs/<RUN>/summary/final.md`, `runs/<RUN>/plan.json`
6) Validate run  
   - Responsible: Operator via tooling  
   - Input: Run folder path  
   - Output: Validation result from `make validate-run RUN="<RUN>"`  
   - Artifact: Console log; run folder stays unchanged on success

## Run Lifecycle
- Start: When the run folder is scaffolded and inputs exist.
- Finish: After `make validate-run RUN="<RUN>"` completes.
- Terminal states: Success (all steps produce artifacts and validation exits 0); Failure (agent error, missing artifacts, or validation exit > 0).

## Verification
- Verified aspects: Plan schema, agent contract envelopes, presence of required artifacts, and run immutability after status queries.
- Trigger: Run `make verify-flow` (executes planner and agents) then `make validate-run RUN="<RUN>"`.
- Pass: All commands exit 0 and outputs match contract expectations.
- Fail: Any command returns non-zero or required files are absent or malformed.

## Expected Artifacts
- `runs/<RUN>/run.json`
- `runs/<RUN>/inputs/request.md`
- `runs/<RUN>/inputs/context.md`
- `runs/<RUN>/outputs/planner/{result.json,notes.md,status.json}`
- `runs/<RUN>/outputs/coordinator/{result.json,notes.md,status.json}`
- `runs/<RUN>/outputs/decision-maker/{result.json,notes.md,status.json}`
- `runs/<RUN>/outputs/pr-reviewer/{result.json,notes.md,status.json}`
- `runs/<RUN>/plan.json`
- `runs/<RUN>/steps/index.json`
- `runs/<RUN>/summary/final.md`

## Non-Goals
- No coverage of gated runs, overrides, or pause/resume flows.
- No integration with external systems or production pipelines.
- No multi-run comparisons or longitudinal reporting.
