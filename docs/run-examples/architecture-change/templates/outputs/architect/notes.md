Architect notes:

- Assumptions: managed queue provides FIFO or ordering keys; latency budget allows eventual consistency for X->Y calls.
- Risks: schema drift if producers and consumers ship out of sync; need DLQ monitoring to prevent silent drops.
- Dependencies: messaging vendor SLA; cross-team agreement on message contracts and retries.
