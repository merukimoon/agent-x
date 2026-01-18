DBA notes:

- Ensure idempotent message handling to avoid duplicate writes during retries.
- Plan online migration for new status tracking without locking existing tables.
- Coordinate with DevOps on retention and purge of DLQ entries.
