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

## Reference Planner Output (JSON)
```json
{
  "goal": "Add LLM Coordinator v1 (planner-only) documentation and a canonical planner prompt, with a minimal golden-path example.",
  "assumptions": [
    {
      "id": "A1",
      "text": "The repository uses /docs, /prompts/canonical, and /examples/golden-path as the canonical locations for documentation and prompts.",
      "confidence": "high"
    }
  ],
  "needs_clarification": false,
  "questions": [],
  "plan": [
    {
      "id": "S1",
      "title": "Create LLM Coordinator v1 concept documentation",
      "action_type": "create_file",
      "inputs": {
        "path": "docs/concepts/llm-coordinator-v1.md",
        "content": "# LLM Coordinator v1 (Planner-only)\n\n## Status\nDraft (v1). Planner-only. Execution is owned by the engine.\n"
      },
      "expected_output": "A new doc file exists at docs/concepts/llm-coordinator-v1.md with the v1 planner-only concept header and status.",
      "verification": [
        {
          "method": "Read the created file and confirm it exists and contains the title and Status section.",
          "success_criteria": "docs/concepts/llm-coordinator-v1.md exists and contains 'LLM Coordinator v1' and '## Status'."
        }
      ],
      "risk": "low",
      "rollback": "Delete docs/concepts/llm-coordinator-v1.md if created in error."
    },
    {
      "id": "S2",
      "title": "Create canonical planner prompt for Coordinator v1",
      "action_type": "create_file",
      "inputs": {
        "path": "prompts/canonical/llm-coordinator-v1-planner.prompt.md",
        "content": "# Canonical Prompt: LLM Coordinator v1 (Planner-only)\n\n## Role\n\nYou are LLM Coordinator v1, operating in Planner-only mode.\n"
      },
      "expected_output": "A new prompt file exists at prompts/canonical/llm-coordinator-v1-planner.prompt.md with a Planner-only role statement and JSON-only output requirement.",
      "verification": [
        {
          "method": "Read the created file and confirm it exists and includes Planner-only guidance and JSON-only requirement.",
          "success_criteria": "prompts/canonical/llm-coordinator-v1-planner.prompt.md exists and mentions Planner-only and valid JSON output."
        }
      ],
      "risk": "low",
      "rollback": "Delete prompts/canonical/llm-coordinator-v1-planner.prompt.md if created in error."
    },
    {
      "id": "S3",
      "title": "Update golden path example to include a reference JSON planner output",
      "action_type": "update_file",
      "inputs": {
        "path": "examples/golden-path/coordinator-planner-only.md",
        "instruction": "Add a new section titled 'Reference Planner Output (JSON)' containing a single valid JSON example with 2-3 steps, explicit verification per step, and needs_clarification=false."
      },
      "expected_output": "The golden path doc includes a concrete JSON example suitable for deterministic engine validation.",
      "verification": [
        {
          "method": "Read examples/golden-path/coordinator-planner-only.md and confirm the new section exists and the JSON parses.",
          "success_criteria": "The doc contains a 'Reference Planner Output (JSON)' section with a JSON block that is valid JSON."
        }
      ],
      "risk": "low",
      "rollback": "Revert the changes to examples/golden-path/coordinator-planner-only.md."
    }
  ]
}
```

## Engine Verification (conceptual)
- Validate JSON schema
- Validate action_type enums
- Confirm file paths are within repo conventions
- Confirm steps include verification
- Execute steps deterministically
- If any validation fails, fallback to rules (reject + request clarification)
