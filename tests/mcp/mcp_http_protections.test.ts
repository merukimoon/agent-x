import { describe, expect, it } from "vitest";
import { createServer } from "../../packages/mcp/src/index";
import { startHttpServer } from "../../packages/mcp/src/transports/http";
import { loadPolicy } from "../../packages/mcp/src/policy/loadPolicy";
import { authorize } from "../../packages/mcp/src/policy/match";
import type { AddressInfo } from "net";

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

describe.sequential("MCP HTTP Protections", () => {
    it("body too large returns 413", async () => {
        const originalMaxBody = process.env.AGENTX_MCP_MAX_BODY_BYTES;
        process.env.AGENTX_MCP_MAX_BODY_BYTES = "100"; // Very small limit
        let httpServer: import("http").Server | null = null;

        try {
            const policy = loadPolicy("http");
            policy.allow.push({ method: "test" });
            const server = createServer({ policy, authorize, transport: "http" });
            server.registerDeterministic("test", () => ({ ok: true }));

            httpServer = startHttpServer(server, {
                port: 0,
                apiKey: "test-key",
                logger: silenceLogger(),
            });

            const address = await waitForServer(httpServer);
            const url = `http://127.0.0.1:${address.port}/mcp`;

            const largePayload = "x".repeat(200); // Exceeds 100 byte limit

            const res = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-agentx-api-key": "test-key",
                },
                body: JSON.stringify({ id: "large", method: "test", payload: largePayload }),
            });

            expect(res.status).toBe(413);
        } finally {
            if (httpServer) {
                await closeServer(httpServer);
            }
            if (originalMaxBody !== undefined) {
                process.env.AGENTX_MCP_MAX_BODY_BYTES = originalMaxBody;
            } else {
                delete process.env.AGENTX_MCP_MAX_BODY_BYTES;
            }
        }
    });

    it("rate limited returns 429", async () => {
        const originalPerMin = process.env.AGENTX_MCP_RL_PER_MIN;
        const originalBurst = process.env.AGENTX_MCP_RL_BURST;
        process.env.AGENTX_MCP_RL_PER_MIN = "2"; // Very low rate
        process.env.AGENTX_MCP_RL_BURST = "2"; // Small burst
        let httpServer: import("http").Server | null = null;

        try {
            const policy = loadPolicy("http");
            policy.allow.push({ method: "test" });
            const server = createServer({ policy, authorize, transport: "http" });
            server.registerDeterministic("test", () => ({ ok: true }));

            httpServer = startHttpServer(server, {
                port: 0,
                apiKey: "test-key",
                logger: silenceLogger(),
            });

            const address = await waitForServer(httpServer);
            const url = `http://127.0.0.1:${address.port}/mcp`;

            // Make requests until rate limited
            let rateLimitedResponse: Response | null = null;

            for (let i = 0; i < 5; i++) {
                const res = await fetch(url, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-agentx-api-key": "test-key",
                    },
                    body: JSON.stringify({ id: `rl-${i}`, method: "test" }),
                });

                if (res.status === 429) {
                    rateLimitedResponse = res;
                    break;
                }

                // Small delay to avoid ECONNRESET from rapid requests
                await new Promise(resolve => setTimeout(resolve, 10));
            }

            expect(rateLimitedResponse).not.toBeNull();
            expect(rateLimitedResponse!.status).toBe(429);
        } finally {
            if (httpServer) {
                await closeServer(httpServer);
            }
            if (originalPerMin !== undefined) {
                process.env.AGENTX_MCP_RL_PER_MIN = originalPerMin;
            } else {
                delete process.env.AGENTX_MCP_RL_PER_MIN;
            }
            if (originalBurst !== undefined) {
                process.env.AGENTX_MCP_RL_BURST = originalBurst;
            } else {
                delete process.env.AGENTX_MCP_RL_BURST;
            }
        }
    });

    it("request timeout returns 504", async () => {
        const originalTimeout = process.env.AGENTX_MCP_TIMEOUT_MS;
        process.env.AGENTX_MCP_TIMEOUT_MS = "100"; // Very short timeout
        let httpServer: import("http").Server | null = null;

        try {
            const policy = loadPolicy("http");
            policy.allow.push({ method: "slow.method" });

            const server = createServer({ policy, authorize, transport: "http" });
            server.registerAsync("slow.method", async () => {
                await new Promise((resolve) => setTimeout(resolve, 500)); // Longer than timeout
                return { ok: true };
            });

            httpServer = startHttpServer(server, {
                port: 0,
                apiKey: "test-key",
                logger: silenceLogger(),
            });

            const address = await waitForServer(httpServer);
            const url = `http://127.0.0.1:${address.port}/mcp`;

            const res = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-agentx-api-key": "test-key",
                },
                body: JSON.stringify({ id: "timeout", method: "slow.method" }),
            });

            expect(res.status).toBe(504);
        } finally {
            if (httpServer) {
                await closeServer(httpServer);
            }
            if (originalTimeout !== undefined) {
                process.env.AGENTX_MCP_TIMEOUT_MS = originalTimeout;
            } else {
                delete process.env.AGENTX_MCP_TIMEOUT_MS;
            }
        }
    });

    it("valid request under limits returns 200", async () => {
        let httpServer: import("http").Server | null = null;

        try {
            const policy = loadPolicy("http");
            policy.allow.push({ method: "test" });
            const server = createServer({ policy, authorize, transport: "http" });
            server.registerDeterministic("test", (payload) => ({ result: "success", input: payload }));

            httpServer = startHttpServer(server, {
                port: 0,
                apiKey: "test-key",
                logger: silenceLogger(),
            });

            const address = await waitForServer(httpServer);
            const url = `http://127.0.0.1:${address.port}/mcp`;

            const res = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-agentx-api-key": "test-key",
                },
                body: JSON.stringify({ id: "valid", method: "test", payload: { value: 123 } }),
            });

            expect(res.status).toBe(200);
            const payload = await res.json();
            expect(payload.ok).toBe(true);
        } finally {
            if (httpServer) {
                await closeServer(httpServer);
            }
        }
    });
});
