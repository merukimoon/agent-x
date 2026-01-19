# Golden Path: Planner-Only Mode v1

## Goal
This example demonstrates a canonical "Planner-only" run. This mode invokes the LLM to generate a structured plan (steps, rationale, dependency graph) but **stops before executing any step**. It is useful for:
- Validating prompt engineering changes.
- Testing the Planner's adherence to safety gates (Exit Code 12).
- Debugging plan logic without side effects.

## Prerequisites
- **Node.js**: v18 or higher.
- **Dependencies**: Run `npm install` in the repo root.
- **Environment**: A `.env` file in the repo root with a valid LLM configuration.

## Required Environment Variables
Ensure your `.env` contains the keys required by your configured provider. See `.env.example`.
Commonly:
- `LLM_PROVIDER` (e.g., `vertex`, `openai`, `anthropic`)
- `LLM_MODEL` (e.g., `gemini-1.5-pro-001`)
- `GOOGLE_CLOUD_PROJECT` (for Vertex) or `API_KEY` (for others)

## Running the Planner
From the repository root:

```bash
# Basic invocation
npm run dev -- planner \
  --goal "$(cat examples/golden-path/planner-only-v1/sample-goal.txt)" \
  --context examples/golden-path/planner-only-v1/sample-context.txt

# Or manually specifying goal/context
npm run dev -- planner \
  --goal "Refactor the status command to show more details" \
  --context "Current output is too terse."
```

## Output Artifacts
Each run creates a unique directory in `runs/<timestamp>/`.

| File | Description |
|------|-------------|
| `planner_raw.json` | The raw JSON structure returned by the LLM. |
| `planner_failed_raw.txt` | (On failure) The raw text that failed JSON parsing. |
| `planner_validation.json` | Detailed pass/fail status of all safety gates and schema checks. |
| `planner_validation_error.json` | (On failure) Structured error info (error code, message). |
| `planner_summary.md` | Human-readable markdown summary of the plan. |

## Exit Codes
The planner uses semantic exit codes to signal the nature of the result:

- **0**: Success. Plan generated and passed all validation gates.
- **10**: **Retryable**. Network error or internal 500. Wrappers should retry with backoff.
- **11**: **Hard Fail**. JSON parse error or malformed schema. Do not retry; prompt or schema needs fixing.
- **12**: **Safety Violation**. The plan contained restricted content or failed a safety gate. Do not retry.

## Troubleshooting

| Symptom | Exit Code | Action |
|---------|-----------|--------|
| Network timeout / 503 | 10 | Wait and retry. |
| "JSON parse failed" | 11 | Check if the model is outputting markdown fences (```json) incorrectly or simple text. |
| "Unknown capability" | 12 | The planner hallucinated a tool. Update `CAPABILITIES` validation list or refine system prompt. |
| "High risk step detected" | 12 | The planner proposed a dangerous action. Review safety policy. |
