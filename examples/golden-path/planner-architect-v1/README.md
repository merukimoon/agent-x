# Golden Path: Planner → Architect Flow v1

## Goal
This example demonstrates a **multi-agent thinking flow** where the Planner agent produces a structured plan, and the Architect agent consumes that plan to produce architectural design decisions. This flow:
- Shows how agents compose naturally in sequence.
- Validates that the flow model scales from single-agent to multi-agent execution.
- Produces reviewable artifacts from both agents with no side effects.

## Purpose
- **Planner**: Generates a structured plan with steps, dependencies, and risk assessment.
- **Architect**: Reviews the plan and produces architectural guidance, design tradeoffs, and compatibility notes.
- **Orchestrator**: Manages sequencing, artifact handoff, and exit code policy enforcement.

This is a **thinking-only flow** — no code is generated or modified.

## Prerequisites
- **Node.js**: v18 or higher.
- **Dependencies**: Run `npm install` in the repo root.
- **Environment**: A `.env` file in the repo root with valid LLM configuration.
- **Make**: Git Bash or WSL on Windows (see README for platform notes).

## Required Environment Variables
Ensure your `.env` contains the keys required by your configured provider. See `.env.example`.
Commonly:
- `LLM_PROVIDER` (e.g., `openai`, `anthropic`, `vertex`)
- `LLM_MODEL` (e.g., `gpt-4o-mini`)
- `OPENAI_API_KEY` or equivalent provider key

## Running the Flow

### Step-by-Step Execution

**Step 1: Run the Planner**
```bash
# From repository root
make planner \
  GOAL="$(cat examples/golden-path/planner-architect-v1/sample-goal.txt)" \
  CONTEXT="$(cat examples/golden-path/planner-architect-v1/sample-context.txt)"
```

This produces a run directory `runs/<timestamp>/` with:
- `planner_raw.json` — Raw LLM output
- `planner_validation.json` — Validation report
- `planner_summary.md` — Human-readable plan summary

**Step 2: Run the Architect (using the Planner's output as context)**

The Architect reviews the plan and produces architectural decisions:

```bash
# Assuming the run ID from Step 1 is stored or noted
RUN_ID="<timestamp-from-step-1>"

# Run architect with the plan as additional context
npm run dev -- agent architect --run "$RUN_ID"
```

This produces additional artifacts in the same run directory:
- `outputs/architect/result.json` — Structured architectural decisions
- `outputs/architect/notes.md` — Design rationale and tradeoffs

**Step 3: Review the aggregated flow**

Check the complete flow outcome:
```bash
ls -la runs/$RUN_ID/
```

## Output Artifacts

### Planner Artifacts (Step 1)
| File | Description |
|------|-------------|
| `planner_raw.json` | Raw JSON structure from the LLM. |
| `planner_validation.json` | Pass/fail status of safety gates and schema checks. |
| `planner_summary.md` | Markdown summary of the plan. |

### Architect Artifacts (Step 2)
| File | Description |
|------|-------------|
| `outputs/architect/result.json` | Structured decisions following Agent Contract. |
| `outputs/architect/notes.md` | Design rationale, options, and compatibility notes. |

### Flow-Level Summary (Optional Enhancement)
For multi-agent flows, you can aggregate outcomes:
- Review both `planner_summary.md` and `architect/notes.md` to understand the complete thinking process.

## How This Differs From Single-Agent Execution

### Single-Agent (Planner-Only v1)
- **Input**: Goal + Context
- **Output**: Plan artifacts
- **Flow**: Linear, one agent

### Multi-Agent (Planner → Architect v1)
- **Input**: Goal + Context (to Planner)
- **Intermediate**: Plan artifacts (Planner → Architect handoff)
- **Output**: Plan artifacts + Architecture decisions
- **Flow**: Sequential, two agents with artifact-based handoff

### Key Insight
The framework does not require special "multi-agent orchestration code." Agents consume and produce artifacts following the Agent Contract. The Orchestrator ensures correct sequencing.

## Exit Codes
Both agents use semantic exit codes:
- **0**: Success
- **10**: Retryable system error (network, LLM timeout)
- **11**: Hard failure (schema/parse error, requires prompt fix)
- **12**: Safety violation (policy gate failure, do not retry)

The Orchestrator can halt the flow on Exit 12 from either agent.

## Troubleshooting

| Issue | Agent | Exit Code | Resolution |
|-------|-------|-----------|------------|
| Network timeout | Planner or Architect | 10 | Retry with backoff |
| Invalid plan schema | Planner | 11 | Refine planner prompt or capability map |
| Hallucinated architecture pattern | Architect | 12 | Review safety gates or architect checklist |
| Missing plan context for Architect | Architect | 11 | Ensure Step 1 (Planner) completed successfully |

## Future Enhancements
- **Automated Sequencing**: A script that chains Planner → Architect automatically.
- **Flow Summary**: A unified report aggregating both agent outputs.
- **Make Target**: `make flow-planner-architect GOAL="..." CONTEXT="..."`
