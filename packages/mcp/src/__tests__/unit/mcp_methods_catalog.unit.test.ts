import { describe, expect, it } from "vitest";
import { createServer, createInprocessTransport, loadPolicy, authorize } from "../../index";

describe("MCP Methods Catalog (unit)", () => {
    it("mcp.list_methods returns metadata for registered methods", () => {
        const policy = loadPolicy("inprocess");
        const server = createServer({ policy, authorize, transport: "inprocess" });

        server.registerDeterministic("test.method", () => ({ ok: true }));
        server.registerAsync("async.method", async () => ({ ok: true }));

        const transport = createInprocessTransport(server);
        const response = transport.send({
            id: "list-1",
            method: "mcp.list_methods",
        });

        expect(response.ok).toBe(true);
        const result = response.result as { methods: any[] };

        expect(Array.isArray(result.methods)).toBe(true);
        expect(result.methods.length).toBeGreaterThan(0);

        const listMethod = result.methods.find((m: any) => m.name === "mcp.list_methods");
        expect(listMethod).toBeDefined();
        expect(listMethod.handler_kind).toBe("deterministic");

        const testMethod = result.methods.find((m: any) => m.name === "test.method");
        expect(testMethod).toBeDefined();
        expect(testMethod.handler_kind).toBe("deterministic");

        const asyncMethod = result.methods.find((m: any) => m.name === "async.method");
        expect(asyncMethod).toBeDefined();
        expect(asyncMethod.handler_kind).toBe("async");
    });

    it("method metadata includes correct exposure based on policy", () => {
        const policy = loadPolicy("http");
        const server = createServer({
            policy,
            authorize,
            transport: "inprocess",
        });

        server.registerDeterministic("test.method", () => ({ ok: true }));

        const transport = createInprocessTransport(server);
        const response = transport.send({
            id: "exposure-1",
            method: "mcp.list_methods",
        });

        expect(response.ok).toBe(true);
        const result = response.result as { methods: any[] };

        const listMethod = result.methods.find((m: any) => m.name === "mcp.list_methods");
        expect(listMethod.exposure).toBe("both");

        const testMethod = result.methods.find((m: any) => m.name === "test.method");
        expect(testMethod.exposure).toBe("internal");
    });
});
