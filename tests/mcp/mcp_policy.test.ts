import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import { createServer, loadPolicy, authorize } from "../../packages/mcp/src/index";
import { startHttpServer } from "../../packages/mcp/src/transports/http";
import type { AddressInfo } from "net";

function silenceLogger() {
  return { log: () => {}, error: () => {}, warn: () => {} } as const;
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

describe("MCP Policy", () => {
  let policyPath: string | undefined;

  beforeEach(() => {
    policyPath = process.env.AGENTX_MCP_POLICY_PATH;
  });

  afterEach(() => {
    if (policyPath !== undefined) {
      process.env.AGENTX_MCP_POLICY_PATH = policyPath;
    } else {
      delete process.env.AGENTX_MCP_POLICY_PATH;
    }
  });

  it("default policy allows mcp.list_methods over HTTP", () => {
    const policy = loadPolicy("http");
    const authResult = authorize({
      method: "mcp.list_methods",
      transport: "http",
    }, policy);

    expect(authResult.ok).toBe(true);
  });

  it("default policy allows runner.technical-writer over HTTP", () => {
    const policy = loadPolicy("http");
    const authResult = authorize({
      method: "runner.technical-writer",
      transport: "http",
    }, policy);

    expect(authResult.ok).toBe(true);
  });

  it("default policy denies unknown method over HTTP", () => {
    const policy = loadPolicy("http");
    const authResult = authorize({
      method: "unknown.method",
      transport: "http",
    }, policy);

    expect(authResult.ok).toBe(false);
    expect(authResult.reason).toContain("not allowed by policy");
  });

  it("in-process transport bypasses policy", () => {
    const policy = loadPolicy("inprocess");
    const authResult = authorize({
      method: "any.method.at.all",
      transport: "inprocess",
    }, policy);

    expect(authResult.ok).toBe(true);
  });

  it("custom policy file allows specific method", async () => {
    const tmpDir = path.join(process.cwd(), "runs", `policy-test-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });

    try {
      const customPolicyPath = path.join(tmpDir, "policy.json");
      const customPolicy = {
        allow: [
          { method: "custom.method" },
        ],
      };
      fs.writeFileSync(customPolicyPath, JSON.stringify(customPolicy), "utf8");
      process.env.AGENTX_MCP_POLICY_PATH = customPolicyPath;

      const policy = loadPolicy("http");
      const authResult = authorize({
        method: "custom.method",
        transport: "http",
      }, policy);

      expect(authResult.ok).toBe(true);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("custom policy file denies method not in allowlist", async () => {
    const tmpDir = path.join(process.cwd(), "runs", `policy-test-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });

    try {
      const customPolicyPath = path.join(tmpDir, "policy.json");
      const customPolicy = {
        allow: [
          { method: "allowed.method" },
        ],
      };
      fs.writeFileSync(customPolicyPath, JSON.stringify(customPolicy), "utf8");
      process.env.AGENTX_MCP_POLICY_PATH = customPolicyPath;

      const policy = loadPolicy("http");
      const authResult = authorize({
        method: "denied.method",
        transport: "http",
      }, policy);

      expect(authResult.ok).toBe(false);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("HTTP server rejects unauthorized method with 403", async () => {
    const policy = loadPolicy("http");
    const server = createServer({ policy, authorize, transport: "http" });
    server.registerDeterministic("allowed.method", () => ({ ok: true }));

    const httpServer = startHttpServer(server, {
      port: 0,
      apiKey: "test-key",
      logger: silenceLogger(),
    });

    const address = await waitForServer(httpServer);
    const url = `http://127.0.0.1:${address.port}/mcp`;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-agentx-api-key": "test-key",
        },
        body: JSON.stringify({
          id: "1",
          method: "unauthorized.method",
        }),
      });

      expect(res.status).toBe(403);
      const payload = await res.json();
      expect(payload.error).toContain("Forbidden");
    } finally {
      await closeServer(httpServer);
    }
  });
});
