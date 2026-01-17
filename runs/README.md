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

