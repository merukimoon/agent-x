# Role Contract Checklist

This checklist defines the minimum required structure for any AgentX role contract.
Each role README contains these sections and satisfies the listed rules.

1. Purpose: States the role’s intent and scope in present tense with no future commitments.
2. Owns: Lists the specific artifacts and decision records the role produces for a run.
3. Cannot: Lists prohibited actions, including plan.json and run.json mutations outside the role’s scope.
4. Blocking Behavior: Declares whether the step is blocking when present in plan.json and cites the failure modes that enforce blocking.
5. Inputs: Lists every required input path the role reads; if a listed input is missing, the role does not run.
6. Outputs: Lists every required output path the role writes, including agent outputs and step artifacts.
7. Invariants: States the path and dependency relationships that must hold for plan.json and outputs for this role.
8. Failure Modes: Enumerates conditions that stop execution or invalidate artifacts, including missing inputs or write failures.
9. Verification Expectations: Describes how verify flow, validate run, and status commands interact with the role’s artifacts and when they fail.
10. Observability: Identifies the run paths that record notes, statuses, decisions, and step results for audit and debugging.
