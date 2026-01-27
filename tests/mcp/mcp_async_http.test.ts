import { describe, expect, it } from "vitest";
import { createServer, createInprocessTransport } from "../../packages/mcp/src/index.ts";
import { startHttpServer } from "../../packages/mcp/src/transports/http.ts";
import { loadPolicy } from "../../packages/mcp/src/policy/loadPolicy.ts";
import { authorize } from "../../packages/mcp/src/policy/match.ts";
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

describe("MCP Async HTTP", () => {
    it.skip("async handler callable via HTTP", async () => {
        const policy = loadPolicy("http");
        // Add async method to policy
        policy.allow.push({ method: "async.test" });

        const server = createServer({ policy, authorize, transport: "http" });
        server.registerAsync("async.test", async (payload) => {
            await new Promise((resolve) => setTimeout(resolve, 10));
            return { result: "async-ok", input: payload };
        });

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
                    id: "async-1",
                    method: "async.test",
                    payload: { value: 123 },
                }),
            });

            expect(res.status).toBe(200);
            const payload = await res.json();
            expect(payload.ok).toBe(true);
            expect(payload.result).toEqual({ result: "async-ok", input: { value: 123 } });
        } finally {
            await closeServer(httpServer);
        }
    });

    it.skip("async handler not callable via in-process transport", () => {
        const server = createServer();
        server.registerAsync("async.method", async () => {
            return { ok: true };
        });

        const transport = createInprocessTransport(server);

        expect(() => {
            transport.send({
                id: "in-process-async",
                method: "async.method",
            });
        }).toThrow();
    });

    it.skip("deterministic handler works in both transports", async () => {
        const policy = loadPolicy("http");
        policy.allow.push({ method: "det.method" });

        const server = createServer({ policy, authorize, transport: "http" });
        server.registerDeterministic("det.method", (payload) => {
            return { deterministic: true, input: payload };
        });

        // Test in-process
        const inprocessTransport = createInprocessTransport(server);
        const inprocessResponse = inprocessTransport.send({
            id: "det-inprocess",
            method: "det.method",
            payload: { value: 42 },
        });

        expect(inprocessResponse.ok).toBe(true);
        expect(inprocessResponse.result).toEqual({ deterministic: true, input: { value: 42 } });

        // Test HTTP
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
                    id: "det-http",
                    method: "det.method",
                    payload: { value: 42 },
                }),
            });

            expect(res.status).toBe(200);
            const payload = await res.json();
            expect(payload.ok).toBe(true);
            expect(payload.result).toEqual({ deterministic: true, input: { value: 42 } });
        } finally {
            await closeServer(httpServer);
        }
    });
});
