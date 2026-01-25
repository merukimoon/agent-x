# Diagnostics

This folder holds one-off diagnostic helpers that are safe to run locally.

- `test-spawn.ts`: prints platform info and attempts to spawn `npm -v`.

Run with:

```bash
node --import tsx scripts/diagnostics/test-spawn.ts
```

Add new diagnostics here instead of the repo root. Keep each script self-contained and read-only where possible.
