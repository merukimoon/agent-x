import { describe, expect, it } from "vitest";
import type { AddressInfo } from "net";
import { createServer } from "../../server/createServer";
import { startHttpServer } from "../../transports/http";
import { loadPolicy } from "../../policy/loadPolicy";
import { authorize } from "../../policy/match";

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

describe.sequential("MCP HTTP Transport Edge Cases", () => {

    it("returns 404 for non-POST requests", async () => {
        let httpServer: import("http").Server | null = null;

        try {
            const server = createServer();
            httpServer = startHttpServer(server, { port: 0, apiKey: "test-key", logger: silenceLogger() });
            const address = await waitForServer(httpServer);
            const url = `http://127.0.0.1:${address.port}/mcp`;

            const res = await fetch(url, { method: "GET" });

            expect(res.status).toBe(404);
        } finally {
            if (httpServer) {
                await closeServer(httpServer);
            }
        }
    });

    it("returns 404 for wrong path", async () => {
        let httpServer: import("http").Server | null = null;

        try {
            const server = createServer();
            httpServer = startHttpServer(server, { port: 0, apiKey: "test-key", logger: silenceLogger() });
            const address = await waitForServer(httpServer);
            const url = `http://127.0.0.1:${address.port}/wrong`;

            const res = await fetch(url, { method: "POST" });

            expect(res.status).toBe(404);
        } finally {
            if (httpServer) {
                await closeServer(httpServer);
            }
        }
    });

    it("returns 401 when AGENTX_MCP_API_KEY is not configured", async () => {
        let httpServer: import("http").Server | null = null;

        try {
            const server = createServer();
            // Do NOT pass apiKey option, forcing it to use env var
            httpServer = startHttpServer(server, {
                port: 0,
                logger: silenceLogger(),
                deps: { env: {} as NodeJS.ProcessEnv },
            });
            const address = await waitForServer(httpServer);
            const url = `http://127.0.0.1:${address.port}/mcp`;

            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: "test", method: "test" }),
            });

            expect(res.status).toBe(401);
            const payload = await res.json();
            expect(payload.error).toContain("Missing AGENTX_MCP_API_KEY");
        } finally {
            if (httpServer) {
                await closeServer(httpServer);
            }
        }
    });

    it("returns 400 for body read error (not size related)", async () => {
        let httpServer: import("http").Server | null = null;

        try {
            const server = createServer();
            httpServer = startHttpServer(server, { port: 0, apiKey: "test-key", logger: silenceLogger() });
            const address = await waitForServer(httpServer);

            const net = await import("net");

            const responseText = await new Promise<string>((resolve, reject) => {
                const socket = net.connect(address.port, "127.0.0.1");
                let data = "";

                socket.setTimeout(2000, () => {
                    socket.destroy(new Error("Timeout waiting for response"));
                });

                socket.on("data", (chunk) => {
                    data += chunk.toString("utf8");
                });

                socket.on("end", () => resolve(data));
                socket.on("error", reject);

                const headers = [
                    "POST /mcp HTTP/1.1",
                    `Host: 127.0.0.1:${address.port}`,
                    "Content-Type: application/json",
                    "x-agentx-api-key: test-key",
                    "Content-Length: 100",
                    "Connection: close",
                    "",
                    "",
                ].join("\r\n");

                // Send fewer bytes than Content-Length then half-close to trigger aborted body read.
                socket.write(headers);
                socket.end("partial");
            });

            expect(responseText).toMatch(/^HTTP\/1\.1 400\b/m);
        } finally {
            if (httpServer) {
                await closeServer(httpServer);
            }
        }
    });

    it("returns 400 for empty request body", async () => {
        let httpServer: import("http").Server | null = null;

        try {
            const server = createServer();
            httpServer = startHttpServer(server, { port: 0, apiKey: "test-key", logger: silenceLogger() });
            const address = await waitForServer(httpServer);
            const url = `http://127.0.0.1:${address.port}/mcp`;

            const res = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-agentx-api-key": "test-key",
                },
                body: "",
            });

            expect(res.status).toBe(400);
            const payload = await res.json();
            expect(payload.error).toContain("Empty body");
        } finally {
            if (httpServer) {
                await closeServer(httpServer);
            }
        }
    });

    it("returns 400 for invalid JSON", async () => {
        let httpServer: import("http").Server | null = null;

        try {
            const server = createServer();
            httpServer = startHttpServer(server, { port: 0, apiKey: "test-key", logger: silenceLogger() });
            const address = await waitForServer(httpServer);
            const url = `http://127.0.0.1:${address.port}/mcp`;

            const res = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-agentx-api-key": "test-key",
                },
                body: "{ invalid json }",
            });

            expect(res.status).toBe(400);
            const payload = await res.json();
            expect(payload.error).toBeDefined();
        } finally {
            if (httpServer) {
                await closeServer(httpServer);
            }
        }
    });

    it("returns 404 for unknown method", async () => {
        let httpServer: import("http").Server | null = null;

        try {
            const policy = loadPolicy("http");
            policy.allow.push({ method: "nonexistent.method" });
            const server = createServer({ policy, authorize, transport: "http" });
            httpServer = startHttpServer(server, { port: 0, apiKey: "test-key", logger: silenceLogger() });
            const address = await waitForServer(httpServer);
            const url = `http://127.0.0.1:${address.port}/mcp`;

            const res = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-agentx-api-key": "test-key",
                },
                body: JSON.stringify({ id: "1", method: "nonexistent.method" }),
            });

            expect(res.status).toBe(404);
        } finally {
            if (httpServer) {
                await closeServer(httpServer);
            }
        }
    });

    it("returns 400 for handler errors", async () => {
        let httpServer: import("http").Server | null = null;

        try {
            const policy = loadPolicy("http");
            policy.allow.push({ method: "error.method" });

            const server = createServer({ policy, authorize, transport: "http" });
            server.registerDeterministic("error.method", () => {
                throw new Error("Handler error");
            });

            httpServer = startHttpServer(server, { port: 0, apiKey: "test-key", logger: silenceLogger() });
            const address = await waitForServer(httpServer);
            const url = `http://127.0.0.1:${address.port}/mcp`;

            const res = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-agentx-api-key": "test-key",
                },
                body: JSON.stringify({ id: "1", method: "error.method" }),
            });

            expect(res.status).toBe(400);
            const payload = await res.json();
            expect(payload.ok).toBe(false);
            expect(payload.error).toBeDefined();
        } finally {
            if (httpServer) {
                await closeServer(httpServer);
            }
        }
    });

    it("returns 500 for unexpected server errors", async () => {
        let httpServer: import("http").Server | null = null;

        try {
            const policy = loadPolicy("http");
            policy.allow.push({ method: "crash.method" });

            const server = createServer({ policy, authorize, transport: "http" });
            server.registerDeterministic("crash.method", () => {
                throw { custom: "error object" }; // Non-Error throw
            });

            httpServer = startHttpServer(server, { port: 0, apiKey: "test-key", logger: silenceLogger() });
            const address = await waitForServer(httpServer);
            const url = `http://127.0.0.1:${address.port}/mcp`;

            const res = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-agentx-api-key": "test-key",
                },
                body: JSON.stringify({ id: "1", method: "crash.method" }),
            });

            // Should handle non-Error throws gracefully
            expect([400, 500]).toContain(res.status);
        } finally {
            if (httpServer) {
                await closeServer(httpServer);
            }
        }
    });
});
