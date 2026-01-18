QA notes:

- Risks: message ordering assumptions, retries causing duplicates, DLQ volume visibility.
- Coverage: regression suite with dual-write; chaos injection for queue outages; consumer idempotency checks.
- Acceptance: no blocking issues; warnings logged as non blocking with follow-ups assigned.
