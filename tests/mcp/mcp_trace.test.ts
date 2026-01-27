import fs from "fs";
import path from "path";
import { describe, expect, it, afterEach } from "vitest";
import { createServer, createInprocessTransport } from "../../packages/mcp/src/index";

function cleanup(dir: string) {
    if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

describe("MCP Trace Propagation", () => {
    const testRunIds: string[] = [];

    afterEach(() => {
        testRunIds.forEach((runId) => {
            const runDir = path.join(process.cwd(), "runs", runId);
            cleanup(runDir);
        });
        testRunIds.length = 0;
    });

    it("trace_id propagated to audit.jsonl", () => {
        const runId = `trace-test-${Date.now()}`;
        testRunIds.push(runId);

        const runDir = path.join(process.cwd(), "runs", runId);
        fs.mkdirSync(runDir, { recursive: true });

        const server = createServer();
        server.registerDeterministic("test.method", () => ({ ok: true }));

        const transport = createInprocessTransport(server);
        const response = transport.send({
            id: "trace-1",
            run_id: runId,
            method: "test.method",
            trace_id: "trace-abc-123",
        });

        expect(response.ok).toBe(true);

        const auditPath = path.join(runDir, "mcp", "audit.jsonl");
        expect(fs.existsSync(auditPath)).toBe(true);

        const lines = fs.readFileSync(auditPath, "utf8").trim().split("\n");
        const record = JSON.parse(lines[0]);

        expect(record.trace_id).toBe("trace-abc-123");
    });

    it("trace_id and parent_id propagated to audit.jsonl", () => {
        const runId = `trace-parent-${Date.now()}`;
        testRunIds.push(runId);

        const runDir = path.join(process.cwd(), "runs", runId);
        fs.mkdirSync(runDir, { recursive: true });

        const server = createServer();
        server.registerDeterministic("test.method", () => ({ ok: true }));

        const transport = createInprocessTransport(server);
        transport.send({
            id: "trace-2",
            run_id: runId,
            method: "test.method",
            trace_id: "trace-xyz",
            parent_id: "step-42",
        });

        const auditPath = path.join(runDir, "mcp", "audit.jsonl");
        const lines = fs.readFileSync(auditPath, "utf8").trim().split("\n");
        const record = JSON.parse(lines[0]);

        expect(record.trace_id).toBe("trace-xyz");
        expect(record.parent_id).toBe("step-42");
    });

    it("trace fields preserved in response", () => {
        const server = createServer();
        server.registerDeterministic("echo", (payload) => ({ echoed: payload }));

        const transport = createInprocessTransport(server);
        const response = transport.send({
            id: "resp-trace",
            method: "echo",
            trace_id: "trace-response-test",
            parent_id: "parent-123",
        });

        expect(response.trace_id).toBe("trace-response-test");
        expect(response.parent_id).toBe("parent-123");
    });
});
