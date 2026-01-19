# Orchestrator Policy

## Overview

The Orchestrator (`scripts/orchestrator/run-planner-with-policy.ts`) wraps the rudimentary `planner` CLI command. It enforces reliability and safety policies by interpreting the planner's semantic exit codes.

The Orchestrator **does not execute plans**. It only manages the *creation* of a valid, safe plan.

## Policies

The orchestrator enforces the following contract based on the Planner's exit codes:

| Exit Code | Meaning | Policy Action |
|-----------|---------|---------------|
| **0** | Success | **Pass**. The plan is valid and safe. |
| **10** | System Error | **Retry**. Network or internal errors (e.g. LLM 503). Retries up to 2 times with backoff. |
| **11** | User Error | **Fail Fast**. The LLM produced invalid JSON. Does not retry. Suggests prompt refinement. |
| **12** | Safety Violation | **Fail Fast**. The plan triggered a safety gate. Never retries. |

## Usage

You can run the orchestrator via the Makefile:

```bash
make orchestrator-planner GOAL="Refactor the auth system" CONTEXT="We use JWTs."
```

Or directly via the script (requires `tsx`):

```bash
node --import tsx scripts/orchestrator/run-planner-with-policy.ts \
  --goal "..." \
  --context "..."
```

## Logs and Artifacts

The orchestrator will output its own logs prefixed with `[Orchestrator]` to distinguish them from the underlying planner logs.

Artifacts (raw JSON, validation reports) are stored in `runs/orch-<timestamp>/` (or `runs/orch-<timestamp>-retryN/` if retries occurred).
