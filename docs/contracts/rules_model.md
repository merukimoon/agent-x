# Rules Model (Soft vs Hard)

## 1) Purpose
- Classify contract rules into soft rules and hard constraints.
- Make violations and verification expectations explicit.

## 2) Definitions
- **Soft Rule**: Recommended; may be violated if annotated.
- **Hard Constraint**: Mandatory; violation makes a run invalid or failed.
- **Violation**: Any deviation from a rule.
- **Annotation**: A written note that records a soft-rule violation.

## 3) Classification Principles
- Soft rules: guidance that does not break determinism or contract shape; current verification does not rely on it; acceptable with explicit annotation.
- Hard constraints: required for run validity, finished criteria, or artifact presence; current verification relies on it or it affects auditability.

## 4) Canonical Rule Table
| Rule ID | Rule | Type | Evidence/Source | How to Record | Verification Expectation |
| --- | --- | --- | --- | --- | --- |
| R1 | Runs must contain `run.json`, `inputs/request.md`, `inputs/context.md`. | Hard | run_artifacts.md §4.1 | N/A | Missing -> fail validate-run |
| R2 | Finished runs must include `plan.json`, `summary/final.md`, `steps/index.json` (when steps exist), and per-agent `outputs/<agent>/result.json` + `notes.md`. | Hard | run_lifecycle.md “Run Finished Criteria”; run_artifacts.md §4.2-4.4 | N/A | Missing -> fail validate-run |
| R3 | `run.json.status` must be `done` with `exit_code=0` for success; `failed` with `exit_code>0` for failure. | Hard | run_lifecycle.md “Run Finished Criteria” | N/A | Mismatch -> fail validate-run |
| R4 | Steps must not omit required per-step files (`decision_after_step.json`, `effective_decision.json`, `step_result.json`) when steps run. | Hard | run_artifacts.md §5 | N/A | Missing -> fail finished-run checks |
| R5 | Agents must write `outputs/<agent>/result.json` and `notes.md` for executed steps; `status.json` is optional. | Hard (required files), Soft (status.json) | agent_contract.md §§5-6 | For Soft: note omission in `outputs/<agent>/notes.md` | Required files missing -> fail; optional noted |
| R6 | Agents must not write outside their `outputs/<agent>/` folder or `artifacts/`. | Hard | agent_contract.md §7 | N/A | Out-of-scope for current automated checks; treat as contract breach if detected |
| R7 | Agents should annotate any soft-rule deviation in `outputs/<agent>/notes.md` with reason and impact. | Soft | rules_model.md §5 | `notes.md` entry describing deviation | Not enforced today; future check may warn |
| R8 | `status` not in `{done, failed}` or missing `finished_at_utc` means run is not finished. | Hard | run_lifecycle.md “Not-finished criteria” | N/A | validate-run should fail finished-run status |
| R9 | Optional artifacts (run README, artifacts/*.md, outputs/*/status.json) may be absent without failing verification. | Soft | run_artifacts.md §6 | None required | No failure if absent |
| R10 | No inventing run state (do not falsify `run.json`, `plan.json`, step lists). | Hard | agent_contract.md §7 | N/A | If detected, fail verification |

## 5) How to Record Violations
- Soft rule violations must be noted in `outputs/<agent>/notes.md` with: rule ID, brief reason, and impact on outcome.
- Hard constraint violations are not annotatable; they fail verification or completion checks.

## 6) Relationship to Verification
- Today: `make validate-run`/`make verify-run` enforce R1-R5, R8; optional items (R9) are ignored.
- Future/enhanced checks: may flag R6 and R10 when detectable; may warn on missing soft-rule annotations (R7).
- Verification never auto-fixes violations; it reports and fails for hard constraints.

## 7) Golden Path Alignment
- Golden Path v0 runs satisfy all hard constraints (R1-R5, R8) and include optional artifacts such as `.gitkeep`; soft rules need no annotations because no deviations occur.

## 8) Non-Goals
- No new enforcement code is defined here.
- No new rules beyond those already documented in contracts.
- No policy for external systems or future flows.
