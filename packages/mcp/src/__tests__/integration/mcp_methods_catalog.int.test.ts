import fs from "fs";
import path from "path";
import { describe, expect, it, afterEach } from "vitest";
import { createServer, createInprocessTransport, loadPolicy, authorize } from "../../index";

function cleanup(dir: string) {
    if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

describe("MCP Methods Catalog (integration)", () => {
    const testRunIds: string[] = [];

    afterEach(() => {
        testRunIds.forEach((runId) => {
            const runDir = path.join(process.cwd(), "runs", runId);
            cleanup(runDir);
        });
        testRunIds.length = 0;
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

        transport.send({
            id: "first",
            run_id: runId,
            method: "test.method",
        });

        const snapshotPath = path.join(runDir, "mcp", "methods.json");
        expect(fs.existsSync(snapshotPath)).toBe(true);

        const firstStats = fs.statSync(snapshotPath);
        const firstMtime = firstStats.mtimeMs;

        const waitMs = 10;
        const before = Date.now();
        while (Date.now() - before < waitMs) {
            // busy wait
        }

        transport.send({
            id: "second",
            run_id: runId,
            method: "test.method",
        });

        const secondStats = fs.statSync(snapshotPath);
        const secondMtime = secondStats.mtimeMs;

        expect(secondMtime).toBe(firstMtime);
    });

    it("snapshot write failure is fail-soft", () => {
        const runId = `catalog-error-${Date.now()}`;
        testRunIds.push(runId);

        const runDir = path.join(process.cwd(), "runs", runId);
        fs.mkdirSync(runDir, { recursive: true });

        const mcpPath = path.join(runDir, "mcp");
        fs.writeFileSync(mcpPath, "block", "utf8");

        const policy = loadPolicy("inprocess");
        const server = createServer({ policy, authorize, transport: "inprocess" });
        server.registerDeterministic("test.method", () => ({ ok: true }));

        const transport = createInprocessTransport(server);

        expect(() => {
            transport.send({
                id: "error",
                run_id: runId,
                method: "test.method",
            });
        }).not.toThrow();
    });

    it("snapshot skips when run directory does not exist", () => {
        const runId = `catalog-nodir-${Date.now()}`;

        const policy = loadPolicy("inprocess");
        const server = createServer({ policy, authorize, transport: "inprocess" });
        server.registerDeterministic("test.method", () => ({ ok: true }));

        const transport = createInprocessTransport(server);

        transport.send({
            id: "nodir",
            run_id: runId,
            method: "test.method",
        });

        const runDir = path.join(process.cwd(), "runs", runId);
        const snapshotPath = path.join(runDir, "mcp", "methods.json");

        expect(fs.existsSync(snapshotPath)).toBe(false);
    });
});
