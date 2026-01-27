# AgentX MCP

The Message Coordination Protocol (MCP) is a minimal request/response bridge that allows AgentX agents to call one another in a deterministic, auditable way. It keeps the server simple: a method registry, auth for external calls, basic policies, and audit logging.

## Internal vs. External
- **Internal (in-process):** Agents use the in-process transport to call registered methods without network hops. This is deterministic and is used for runner integrations such as the technical writer.
- **External (HTTP):** A single HTTP endpoint (`POST /mcp`) accepts JSON MCP requests so other processes can call AgentX runners. Responses mirror the MCP response shape.

## Running the HTTP Server
1. Set an API key: `export AGENTX_MCP_API_KEY=<your-key>`.
2. Choose a port (defaults to 7801): `export MCP_PORT=7801` (optional).
3. Start the server: `node --import tsx scripts/mcp/run-mcp-server.ts`.
4. Send requests: `curl -H "Content-Type: application/json" -H "x-agentx-api-key: <your-key>" -d '{"id":"1","method":"runner.technical-writer","payload":{...}}' http://localhost:7801/mcp`.

## Security Note
External HTTP access is protected by a simple API key allowlist. The server refuses all requests when `AGENTX_MCP_API_KEY` is not set. Keep the key secret and rotate it regularly; no other authentication is provided in this MVP.
