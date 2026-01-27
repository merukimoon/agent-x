# AgentX MCP

The Message Coordination Protocol (MCP) is a minimal request/response bridge that allows AgentX agents to call one another in a deterministic, auditable way. It keeps the server simple: a method registry, auth for external calls, policy-based access control, and comprehensive audit logging.

## Features

- **Deterministic in-process transport** for internal agent coordination
- **HTTP transport** with comprehensive protections for external access
- **Policy-based authorization** with allowlist-based method access control
- **Correlation tracing** via `trace_id` and `parent_id` fields
- **Rate limiting**, body size limits, and request timeouts for HTTP
- **Self-describing protocol** with `mcp.list_methods` built-in
- **Audit logging** of all requests with trace correlation

## Internal vs. External

- **Internal (in-process):** Agents use the in-process transport to call registered methods without network hops. This is deterministic and is used for runner integrations such as the technical writer. Only synchronous (deterministic) methods are callable via in-process transport.
- **External (HTTP):** A single HTTP endpoint (`POST /mcp`) accepts JSON MCP requests so other processes can call AgentX runners. Both synchronous and asynchronous methods can be called via HTTP. Responses mirror the MCP response shape.

## Method Registration

Methods must be registered as either deterministic (synchronous) or async (asynchronous):

```typescript
import { createServer } from "@agentx/mcp";

const server = createServer();

// Deterministic (synchronous) method - callable from both transports
server.registerDeterministic("my.method", (payload, request) => {
  return { result: "sync result" };
});

// Async method - callable only from HTTP transport
server.registerAsync("my.async.method", async (payload, request) => {
  await someAsyncOperation();
  return { result: "async result" };
});

// Deprecated: registerMethod() is an alias for registerDeterministic()
// Use registerDeterministic() explicitly in new code
server.registerMethod("legacy.method", (payload) => {
  return { ok: true };
});
```

## Policy Configuration

Configure method authorization via `AGENTX_MCP_POLICY_PATH` environment variable.

**Format:**
```json
{
  "allow": [
    { "method": "runner.technical-writer", "from": "*", "to": "*" },
    { "method": "my.custom.method" }
  ]
}
```

**Default policy:** Only `mcp.list_methods` and `runner.technical-writer` are allowed over HTTP by default. All methods are allowed for in-process transport.

**Policy loading:**
- For HTTP transport: Policy load failures are **fail-hard** (server won't start)
- For in-process transport: Policy load failures are **fail-soft** (warning logged, default policy used)

## HTTP Protections

HTTP transport includes comprehensive protections:

- **Rate limiting:** 60 requests/min with burst of 20 (configurable)
  - `AGENTX_MCP_RL_PER_MIN` - requests per minute (default: 60)
  - `AGENTX_MCP_RL_BURST` - burst size (default: 20)
- **Body size limit:** 1 MB maximum (configurable)
  - `AGENTX_MCP_MAX_BODY_BYTES` - max request body size in bytes (default: 1048576)
- **Request timeout:** 30 seconds (configurable)
  - `AGENTX_MCP_TIMEOUT_MS` - request timeout in milliseconds (default: 30000)

**HTTP status codes:**
- `413 Payload Too Large` - request body exceeds size limit
- `429 Too Many Requests` - rate limit exceeded
- `504 Gateway Timeout` - request exceeded timeout
- `403 Forbidden` - method not allowed by policy
- `401 Unauthorized` - missing or invalid API key

## Running the HTTP Server

1. Set an API key: `export AGENTX_MCP_API_KEY=<your-key>`.
2. (Optional) Configure policy: `export AGENTX_MCP_POLICY_PATH=/path/to/policy.json`.
3. (Optional) Choose a port: `export MCP_PORT=7801` (default: 7801).
4. Start the server: `node --import tsx scripts/mcp/run-mcp-server.ts`.
5. Send requests:
   ```bash
   curl -H "Content-Type: application/json" \
        -H "x-agentx-api-key: <your-key>" \
        -d '{"id":"1","method":"mcp.list_methods"}' \
        http://localhost:7801/mcp
   ```

## Built-in Methods

### `mcp.list_methods`

Returns metadata for all registered methods:

```json
{
  "methods": [
    {
      "name": "runner.technical-writer",
      "handler_kind": "deterministic",
      "exposure": "both",
      "description": "",
      "payload_schema": null
    },
    {
      "name": "my.async.method",
      "handler_kind": "async",
      "exposure": "external",
      "description": "",
      "payload_schema": null
    }
  ]
}
```

**Exposure values:**
- `internal` - deterministic method not in policy (in-process only)
- `external` - async method (HTTP only)
- `both` - deterministic method in policy (both transports)

## Tracing and Correlation

Add `trace_id` and `parent_id` to requests for correlation across distributed calls:

```typescript
const transport = createInprocessTransport(server);
const response = transport.send({
  id: "req-123",
  method: "runner.technical-writer",
  trace_id: runId,        // For correlation
  parent_id: stepId,      // Parent step/request
  payload: { ... }
});

// trace_id and parent_id are preserved in the response
console.log(response.trace_id, response.parent_id);
```

These fields are also written to audit logs (`runs/<run_id>/mcp/audit.jsonl`) for observability.

## Audit Logging

All MCP requests are logged to `runs/<run_id>/mcp/audit.jsonl` when a `run_id` is provided:

```json
{
  "ts": "2026-01-27T10:00:00.000Z",
  "id": "req-123",
  "run_id": "run-456",
  "from": "agent.runner",
  "to": "technical-writer",
  "method": "runner.technical-writer",
  "ok": true,
  "duration_ms": 42,
  "error": null,
  "trace_id": "run-456",
  "parent_id": "step-5"
}
```

## Method Catalog Snapshot

On the first MCP request for each `run_id`, a snapshot of all registered methods is written to `runs/<run_id>/mcp/methods.json`. This provides documentation of what methods were available for that specific run.

## Security Note

External HTTP access is protected by:
1. **API key authentication** - set `AGENTX_MCP_API_KEY`
2. **Policy-based authorization** - only allowed methods can be called
3. **Rate limiting** - prevents abuse
4. **Request size limits** - prevents DoS attacks
5. **Timeouts** - prevents resource exhaustion

Keep the API key secret and rotate it regularly. Configure policy to allow only the minimum necessary methods for HTTP access.
