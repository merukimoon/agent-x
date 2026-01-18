Security notes:

- Ensure queue IAM roles are least privilege; producers can publish, consumers can read/ack.
- Confirm encryption defaults and key rotation policy with vendor.
- Audit logging: record message IDs and metadata only; avoid payload logging to reduce PII exposure.
