# Golden Path: Coordinator Planner-only (Minimal Example)

## Scenario
We want to add a new concept doc and canonical prompt for LLM Coordinator v1, without implementing any engine code.

## Input to Planner
- goal: "Add LLM Coordinator v1 (planner-only) documentation, canonical prompt, and golden-path example to the repository."
- constraints:
  - "No implementation code"
  - "Planner-only: LLM proposes, engine verifies, rules fallback"
  - "Keep docs short and non-marketing"
- capabilities (example):
  - allowed action_type:
    - "create_file"
    - "update_file"
    - "list_repo_tree"
    - "suggest_commit"
- context:
  - repo uses /docs, /prompts/canonical, /examples/golden-path

## Expected Planner Output (shape)
- needs_clarification: false
- plan steps:
  1) create_file /docs/concepts/llm-coordinator-v1.md
  2) create_file /prompts/canonical/llm-coordinator-v1-planner.prompt.md
  3) create_file /examples/golden-path/coordinator-planner-only.md
  4) suggest_commit with message and file list

## Engine Verification (conceptual)
- Validate JSON schema
- Validate action_type enums
- Confirm file paths are within repo conventions
- Confirm steps include verification
- Execute steps deterministically
- If any validation fails, fallback to rules (reject + request clarification)
