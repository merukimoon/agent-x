Tech Lead notes:

- Dependencies: messaging client library selection; shared schema repo location; feature flag for dual-write.
- Risks: consumer lag causing backlog; need backpressure handling strategy.
- Verification: smoke tests for enqueue/dequeue paths; synthetic load to validate throughput limits.
