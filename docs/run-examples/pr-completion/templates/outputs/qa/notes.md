Scope:

- PR touches docs and config default for a feature flag.

Risks:

- Misaligned docs and config default could confuse rollout.
- Minimal regression risk; no code changes beyond config.

Quality gates:

- Docs and config describe the same default.
- Smoke tests (if available) pass with flag on and off.

Questions:

- None.
