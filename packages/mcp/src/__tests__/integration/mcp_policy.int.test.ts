import { describe, expect, it } from "vitest";
import { createServer, loadPolicy, authorize } from "../../index";
import { startHttpServer } from "../../transports/http";
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

describe("MCP Policy (integration)", () => {
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
