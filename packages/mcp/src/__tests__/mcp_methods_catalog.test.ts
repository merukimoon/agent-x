import fs from "fs";
import path from "path";
import { describe, expect, it, afterEach } from "vitest";
import { createServer, createInprocessTransport, loadPolicy, authorize } from "../index";

function cleanup(dir: string) {
    if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

describe("MCP Methods Catalog", () => {
    const testRunIds: string[] = [];

    afterEach(() => {
        testRunIds.forEach((runId) => {
            const runDir = path.join(process.cwd(), "runs", runId);
            cleanup(runDir);
        });
        testRunIds.length = 0;
    });

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
        // runner.technical-writer is in default policy, test.method is not
        const server = createServer({
            policy, authorize, transport: "inprocess"
        });

        server.registerDeterministic("test.method", () => ({ ok: true }));

        const transport = createInprocessTransport(server);
        const response = transport.send({
            id: "exposure-1",
            method: "mcp.list_methods",
        });

        expect(response.ok).toBe(true);
        const result = response.result as { methods: any[] };

        // mcp.list_methods should be in default policy -> "both"
        const listMethod = result.methods.find((m: any) => m.name === "mcp.list_methods");
        expect(listMethod.exposure).toBe("both");

        // test.method is deterministic but NOT in policy -> "internal"
        const testMethod = result.methods.find((m: any) => m.name === "test.method");
        expect(testMethod.exposure).toBe("internal");
    });

    it("per-run snapshot creates methods.json", () => {
        const runId = `catalog-${Date.now()}`;
        testRunIds.push(runId);

        const runDir = path.join(process.cwd(), "runs", runId);
        fs.mkdirSync(runDir, { recursive: true });

        const policy = loadPolicy("inprocess");
        const server = createServer({ policy, authorize, transport: "inprocess" });
        server.registerDeterministic("test.method", () => ({ ok: true }));

        const transport = createInprocessTransport(server);
        transport.send({
            id: "snapshot-1",
            run_id: runId,
            method: "test.method",
        });

        const snapshotPath = path.join(runDir, "mcp", "methods.json");
        expect(fs.existsSync(snapshotPath)).toBe(true);

        const snapshot = JSON.parse(fs.readFileSync(snapshotPath, "utf8"));
        expect(snapshot.methods).toBeDefined();
        expect(Array.isArray(snapshot.methods)).toBe(true);
    });

    it("snapshot created only once per run_id", () => {
        const runId = `catalog-once-${Date.now()}`;
        testRunIds.push(runId);

        const runDir = path.join(process.cwd(), "runs", runId);
        fs.mkdirSync(runDir, { recursive: true });

        const policy = loadPolicy("inprocess");
        const server = createServer({ policy, authorize, transport: "inprocess" });
        server.registerDeterministic("test.method", () => ({ ok: true }));

        const transport = createInprocessTransport(server);

        // First request
        transport.send({
            id: "first",
            run_id: runId,
            method: "test.method",
        });

        const snapshotPath = path.join(runDir, "mcp", "methods.json");
        expect(fs.existsSync(snapshotPath)).toBe(true);

        const firstStats = fs.statSync(snapshotPath);
        const firstMtime = firstStats.mtimeMs;

        // Wait a bit to ensure mtime would change if file was rewritten
        const waitMs = 10;
        const before = Date.now();
        while (Date.now() - before < waitMs) {
            // busy wait
        }

        // Second request
        transport.send({
            id: "second",
            run_id: runId,
            method: "test.method",
        });

        const secondStats = fs.statSync(snapshotPath);
        const secondMtime = secondStats.mtimeMs;

        // Mtime should be the same (file not rewritten)
        expect(secondMtime).toBe(firstMtime);
    });

    it("snapshot write failure is fail-soft", () => {
        // Use a run_id but don't create the runs directory
        // This should trigger fail-soft behavior (warn, no throw)
        const runId = `catalog-nosuchdir-${Date.now()}`;

        const policy = loadPolicy("inprocess");
        const server = createServer({ policy, authorize, transport: "inprocess" });
        server.registerDeterministic("test.method", () => ({ ok: true }));

        const transport = createInprocessTransport(server);

        // Should not throw even though runs dir doesn't exist
        expect(() => {
            transport.send({
                id: "failsoft",
                run_id: runId,
                method: "test.method",
            });
        }).not.toThrow();
    });
});
