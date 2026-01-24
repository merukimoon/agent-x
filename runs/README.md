# Runs (execution outputs)

This directory contains **execution runs** and produced artifacts.

## What a “run” is

A run is one attempt to execute a Task under a specific Policy, producing:

- agent outputs (structured responses)
- artifacts (files/diffs/data)
- logs and traces (if enabled)

Runs are the primary unit of reproducibility and debugging.

## Directory naming (recommended)

Create one folder per run:

```text
runs/<run-id>/
```

Where `<run-id>` is unique and sortable. Example patterns:

- `2026-01-17T08-20-00Z_task-123_run-001`
- `run-2026-01-17T08-20-00Z-001`

The exact format is not enforced yet (**TODO**).

## Typical contents of a run folder (conceptual)

A run folder MAY contain:

- `run.json` Run metadata (task_id, policy summary, participants) (**TODO**)
- `messages.jsonl` Message/event stream (**TODO**)
- `artifacts/` Produced artifacts (files/diffs/data) (**TODO**)
- `logs/` Structured logs (**TODO**)

## Git policy

Run outputs are usually **not committed** to git:

- They can be large and frequently changing.
- They may contain sensitive data.

This repository ignores `runs/` by default, while keeping `runs/README.md` tracked.

## How to create a run

From the repository root:

- `make run-new NAME="<short-slug>"`

Example:

- `make run-new NAME="docs-pr-audit"`

Then inspect it with:

- `make run-tree RUN="<run-folder-name>"`

## How to resolve a gated run

1) Identify a blocked run  
   - Run status: `make run-status RUN="<run-id>"`  
   - If the output shows `State: BLOCKED`, note the `Blocked step` value.

2) Inspect the step artifacts  
   - `runs/<run-id>/steps/<step-id>/human_prompt.md` describes what is needed.  
   - `decision_after_step.json` shows the base decision.  
   - `effective_decision.json` shows the applied decision (after any override).  
   - If the decision lists `required_inputs`, gather those inputs.

3) Create an override (only when the base action is `require_human` or `request_clarification`)  
   - Path: `runs/<run-id>/steps/<step-id>/override.json`  
   - Create the file manually with a clear reason. Example:

```json
{
  "schema_version": "step-override.v1",
  "run_id": "<run-id>",
  "step_id": "<step-id>",
  "actor": { "type": "human", "id": "operator@example.com" },
  "override_action": "continue",
  "routing_override": { "next_agent": null, "next_model": null },
  "acknowledged_risks": ["Reviewed human prompt and approved"]
}
```

4) Apply and re-check  
   - Rerun the relevant flow or command. The override is applied deterministically to future steps.  
   - Re-check status: `make run-status RUN="<run-id>"` to confirm the run is unblocked.
