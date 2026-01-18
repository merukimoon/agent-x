## Context

- Current architecture: synchronous HTTP calls between services X and Y; retries handled at caller; limited observability for cross-service failures.
- Known pain points: cascading timeouts during peak load; tight coupling on versioned DTOs; no durable queue or DLQ in place.
- Existing decisions: ADR-012 (service boundaries), ADR-019 (audit logging), `docs/architecture.md` sections on error handling.
- Non goals: changing the data model or UI; altering authentication/authorization flows.
- References:
  - Link to ADR-012 summary
  - Link to ADR-019 summary
  - Link to relevant incident postmortems (if any)
  - Link to proposed messaging vendor comparison (if available)
