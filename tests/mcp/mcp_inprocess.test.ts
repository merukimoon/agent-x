import { describe, expect, it } from "vitest";
import { createServer, createInprocessTransport, PROTOCOL_VERSION } from "../../packages/mcp/src/index";

describe("MCP in-process transport", () => {
  it("routes to registered method and returns payload", () => {
    const server = createServer();
    server.registerMethod("echo", (payload) => ({ echoed: payload }));
    const transport = createInprocessTransport(server);

    const response = transport.send({
      id: "1",
      method: "echo",
      payload: { value: 123 },
    });

    expect(response.protocol_version).toBe(PROTOCOL_VERSION);
    expect(response.ok).toBe(true);
    expect(response.result).toEqual({ echoed: { value: 123 } });
  });
});
