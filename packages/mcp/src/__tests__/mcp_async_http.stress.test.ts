import { describe, expect, it } from "vitest";
import { createServer, createInprocessTransport } from "../index";
import { startHttpServer } from "../transports/http";
import { loadPolicy } from "../policy/loadPolicy";
import { authorize } from "../policy/match";
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
    it("async handler callable via HTTP", async () => {
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

    it("async handler not callable via in-process transport", () => {
        const server = createServer();
        server.registerAsync("async.method", async () => {
            return { ok: true };
        });

        const transport = createInprocessTransport(server);
        const response = transport.send({
            id: "in-process-async",
            method: "async.method",
        });

        expect(response.ok).toBe(false);
        expect(response.error?.message).toContain("Async MCP handlers are not supported");
    });

    it("deterministic handler works in both transports", async () => {
        const policy = loadPolicy("http");
        policy.allow.push({ method: "det.method" });

        // Test in-process: create server with inprocess transport
        const inprocessServer = createServer({ policy, authorize, transport: "inprocess" });
        inprocessServer.registerDeterministic("det.method", (payload) => {
            return { deterministic: true, input: payload };
        });

        const inprocessTransport = createInprocessTransport(inprocessServer);
        const inprocessResponse = inprocessTransport.send({
            id: "det-inprocess",
            method: "det.method",
            payload: { value: 42 },
        });

        expect(inprocessResponse.ok).toBe(true);
        expect(inprocessResponse.result).toEqual({ deterministic: true, input: { value: 42 } });

        // Test HTTP: create server with http transport
        const httpMcpServer = createServer({ policy, authorize, transport: "http" });
        httpMcpServer.registerDeterministic("det.method", (payload) => {
            return { deterministic: true, input: payload };
        });
        const httpServer = startHttpServer(httpMcpServer, {
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
