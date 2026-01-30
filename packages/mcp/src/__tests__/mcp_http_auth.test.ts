import { describe, expect, it } from "vitest";
import type { AddressInfo } from "net";
import { createServer, startHttpServer } from "../index";

function silenceLogger() {
  return { log: () => { }, error: () => { }, warn: () => { } } as const;
}

function closeServer(server: import("http").Server) {
  return new Promise<void>((resolve) => server.close(() => resolve()));
}

async function waitForServer(server: import("http").Server) {
  if (!server.listening) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Server address unavailable");
  }
  return address as AddressInfo;
}

describe.sequential("MCP HTTP transport auth", () => {
  it("returns 401 when API key is missing", async () => {
    const original = process.env.AGENTX_MCP_API_KEY;
    delete process.env.AGENTX_MCP_API_KEY;
    let httpServer: import("http").Server | null = null;

    try {
      const server = createServer();
      httpServer = startHttpServer(server, { port: 0, logger: silenceLogger() });
      const address = await waitForServer(httpServer);
      const url = `http://127.0.0.1:${address.port}/mcp`;

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: "missing-key", method: "noop" }),
      });

      expect(res.status).toBe(401);
    } finally {
      if (httpServer) {
        await closeServer(httpServer);
      }
      if (original !== undefined) {
        process.env.AGENTX_MCP_API_KEY = original;
      } else {
        delete process.env.AGENTX_MCP_API_KEY;
      }
    }
  });

  it("returns 200 with valid API key", async () => {
    let httpServer: import("http").Server | null = null;

    try {
      const server = createServer();
      server.registerMethod("ping", () => ({ pong: true }));
      httpServer = startHttpServer(server, { port: 0, apiKey: "secret", logger: silenceLogger() });
      const address = await waitForServer(httpServer);
      const url = `http://127.0.0.1:${address.port}/mcp`;

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-agentx-api-key": "secret",
        },
        body: JSON.stringify({ id: "with-key", method: "ping", protocol_version: "mcp.v1" }),
      });

      expect(res.status).toBe(200);
      const payload = await res.json();
      expect(payload.ok).toBe(true);
      expect(payload.result).toEqual({ pong: true });
    } finally {
      if (httpServer) {
        await closeServer(httpServer);
      }
    }
  });

  it("routes runner.technical-writer via HTTP", async () => {
    let httpServer: import("http").Server | null = null;

    try {
      const server = createServer();
      server.registerMethod("runner.technical-writer", (input) => ({
        status: "done",
        summary: (input as any)?.summary ?? "ok",
      }));
      httpServer = startHttpServer(server, { port: 0, apiKey: "route-key", logger: silenceLogger() });
      const address = await waitForServer(httpServer);
      const url = `http://127.0.0.1:${address.port}/mcp`;

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-agentx-api-key": "route-key",
        },
        body: JSON.stringify({
          id: "route",
          method: "runner.technical-writer",
          payload: { summary: "hello" },
        }),
      });

      expect(res.status).toBe(200);
      const payload = (await res.json()) as any;
      expect(payload.ok).toBe(true);
      expect((payload.result as any).summary).toBe("hello");
    } finally {
      if (httpServer) {
        await closeServer(httpServer);
      }
    }
  });
});
