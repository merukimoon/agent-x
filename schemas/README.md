# Schemas (contracts and structured data)

This directory contains **schemas** for structured inputs/outputs, artifacts, and contracts.

Schemas help make agent runs automatable:

- Coordinators can validate agent responses
- Tools can consume artifacts predictably
- Logs can be parsed and analyzed

No schema format is enforced yet; this repo remains language-agnostic (**TODO**).

## What schemas are used for

Typical schema targets:

- Agent response envelope (see `docs/agent-contract.md`)
- Artifact payloads (files/diffs/data references)
- Run metadata (run_id, task_id, timestamps, policy fingerprints) (**TODO**)
- Logging events (structured logs) (**TODO**)

## Expected formats (conceptual)

When implementation begins, schemas MAY be expressed as:

- JSON Schema
- YAML schema conventions
- OpenAPI/AsyncAPI components
- Protobuf/Avro IDLs

Pick one and document it here when the tooling is chosen (**TODO**).

## Relationship to the Agent Contract

`docs/agent-contract.md` defines the normative fields and invariants. Schemas in this directory SHOULD be derived from that contract and versioned alongside it.

