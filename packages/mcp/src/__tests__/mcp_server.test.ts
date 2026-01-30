import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import { createServer } from "../server/createServer";
import { loadPolicy } from "../policy/loadPolicy";
import { authorize } from "../policy/match";
import type { MCPRequest } from "../protocol/messages";

describe("MCP CreateServer", () => {
    let tmpDir: string;
    const testRunIds: string[] = [];

    beforeEach(() => {
        tmpDir = path.join(process.cwd(), "runs", `server-test-${Date.now()}`);
    });

    afterEach(() => {
        testRunIds.forEach((runId) => {
            const runDir = path.join(process.cwd(), "runs", runId);
            if (fs.existsSync(runDir)) {
                fs.rmSync(runDir, { recursive: true, force: true });
            }
        });
        testRunIds.length = 0;

        if (fs.existsSync(tmpDir)) {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        }
    });

    describe("getMethodsCatalog", () => {
        it("returns empty array when no policy is provided", () => {
            const server = createServer();
            const catalog = server.getMethodsCatalog();

            expect(catalog).toEqual([]);
        });

        it("returns catalog with methods when policy is provided", () => {
            const policy = loadPolicy("inprocess");
            const server = createServer({ policy });

            const catalog = server.getMethodsCatalog();

            expect(Array.isArray(catalog)).toBe(true);
            expect(catalog.length).toBeGreaterThan(0);
        });
    });

    describe("HTTP transport - unknown method", () => {
        it("returns error for unknown method in HTTP transport", async () => {
            const policy = loadPolicy("http");
            const server = createServer({ policy, authorize, transport: "http" });

            const request: MCPRequest = {
                id: "unknown-1",
                method: "nonexistent.method",
            };

            const response = await server.handleRequest(request);

            expect(response.ok).toBe(false);
            expect(response.error).toBeDefined();
            expect(response.error?.message).toContain("Unknown method");
        });
    });

    describe("HTTP transport - async method execution", () => {
        it("executes async handler successfully in HTTP transport", async () => {
            const policy = loadPolicy("http");
            policy.allow.push({ method: "async.test" });

            const server = createServer({ policy, authorize, transport: "http" });
            server.registerAsync("async.test", async (payload) => {
                return { result: "async-success", input: payload };
            });

            const request: MCPRequest = {
                id: "async-1",
                method: "async.test",
                payload: { data: "test" },
            };

            const response = await server.handleRequest(request);

            expect(response.ok).toBe(true);
            expect(response.result).toEqual({
                result: "async-success",
                input: { data: "test" },
            });
        });

        it("returns error when async handler is called on inprocess transport", () => {
            const policy = loadPolicy("inprocess");
            const server = createServer({ policy, transport: "inprocess" });

            server.registerAsync("async.method", async () => ({ ok: true }));

            const request: MCPRequest = {
                id: "async-inprocess",
                method: "async.method",
            };

            const response = server.handleRequest(request);

            expect(response.ok).toBe(false);
            expect(response.error?.message).toContain("Async MCP handlers are not supported in in-process transport");
        });
    });

    describe("Error handling", () => {
        it("catches and returns error when deterministic handler throws in HTTP", async () => {
            const policy = loadPolicy("http");
            policy.allow.push({ method: "error.method" });

            const server = createServer({ policy, authorize, transport: "http" });
            server.registerDeterministic("error.method", () => {
                throw new Error("Handler error");
            });

            const request: MCPRequest = {
                id: "error-1",
                method: "error.method",
            };

            const response = await server.handleRequest(request);

            expect(response.ok).toBe(false);
            expect(response.error?.message).toBe("Handler error");
        });

        it("catches and returns error when deterministic handler throws in inprocess", () => {
            const policy = loadPolicy("inprocess");
            const server = createServer({ policy, transport: "inprocess" });

            server.registerDeterministic("error.method", () => {
                throw new Error("Inprocess error");
            });

            const request: MCPRequest = {
                id: "error-inprocess",
                method: "error.method",
            };

            const response = server.handleRequest(request);

            expect(response.ok).toBe(false);
            expect(response.error?.message).toBe("Inprocess error");
        });

        it("handles non-Error thrown values", async () => {
            const policy = loadPolicy("http");
            policy.allow.push({ method: "string.error" });

            const server = createServer({ policy, authorize, transport: "http" });
            server.registerDeterministic("string.error", () => {
                throw "string error message";
            });

            const request: MCPRequest = {
                id: "string-error",
                method: "string.error",
            };

            const response = await server.handleRequest(request);

            expect(response.ok).toBe(false);
            expect(response.error?.message).toBe("string error message");
        });
    });

    describe("Audit logging", () => {
        it("writes audit log when run_id is provided in HTTP transport", async () => {
            const runId = `audit-http-${Date.now()}`;
            testRunIds.push(runId);

            const runDir = path.join(process.cwd(), "runs", runId);
            fs.mkdirSync(runDir, { recursive: true });

            const policy = loadPolicy("http");
            policy.allow.push({ method: "audit.test" });

            const server = createServer({ policy, authorize, transport: "http" });
            server.registerDeterministic("audit.test", () => ({ ok: true }));

            const request: MCPRequest = {
                id: "audit-1",
                run_id: runId,
                method: "audit.test",
                trace_id: "trace-123",
                parent_id: "parent-456",
            };

            await server.handleRequest(request);

            const auditPath = path.join(runDir, "mcp", "audit.jsonl");
            expect(fs.existsSync(auditPath)).toBe(true);

            const auditContent = fs.readFileSync(auditPath, "utf8");
            const auditRecord = JSON.parse(auditContent.trim());

            expect(auditRecord.id).toBe("audit-1");
            expect(auditRecord.run_id).toBe(runId);
            expect(auditRecord.method).toBe("audit.test");
            expect(auditRecord.ok).toBe(true);
            expect(auditRecord.trace_id).toBe("trace-123");
            expect(auditRecord.parent_id).toBe("parent-456");
        });

        it("writes audit log when run_id is provided in inprocess transport", () => {
            const runId = `audit-inprocess-${Date.now()}`;
            testRunIds.push(runId);

            const runDir = path.join(process.cwd(), "runs", runId);
            fs.mkdirSync(runDir, { recursive: true });

            const policy = loadPolicy("inprocess");
            const server = createServer({ policy, transport: "inprocess" });
            server.registerDeterministic("audit.test", () => ({ ok: true }));

            const request: MCPRequest = {
                id: "audit-inprocess",
                run_id: runId,
                method: "audit.test",
            };

            server.handleRequest(request);

            const auditPath = path.join(runDir, "mcp", "audit.jsonl");
            expect(fs.existsSync(auditPath)).toBe(true);
        });

        it("audit logging is fail-soft when write fails in HTTP", async () => {
            const runId = `audit-fail-http-${Date.now()}`;
            testRunIds.push(runId);

            const runDir = path.join(process.cwd(), "runs", runId);
            fs.mkdirSync(runDir, { recursive: true });

            // Create mcp as a file to force audit write error
            const mcpPath = path.join(runDir, "mcp");
            fs.writeFileSync(mcpPath, "block", "utf8");

            const policy = loadPolicy("http");
            policy.allow.push({ method: "test" });

            const server = createServer({ policy, authorize, transport: "http" });
            server.registerDeterministic("test", () => ({ ok: true }));

            const request: MCPRequest = {
                id: "audit-fail",
                run_id: runId,
                method: "test",
            };

            // Should not throw despite audit write error
            await expect(server.handleRequest(request)).resolves.toBeDefined();
        });

        it("audit logging is fail-soft when write fails in inprocess", () => {
            const runId = `audit-fail-inprocess-${Date.now()}`;
            testRunIds.push(runId);

            const runDir = path.join(process.cwd(), "runs", runId);
            fs.mkdirSync(runDir, { recursive: true });

            // Create mcp as a file to force audit write error
            const mcpPath = path.join(runDir, "mcp");
            fs.writeFileSync(mcpPath, "block", "utf8");

            const policy = loadPolicy("inprocess");
            const server = createServer({ policy, transport: "inprocess" });
            server.registerDeterministic("test", () => ({ ok: true }));

            const request: MCPRequest = {
                id: "audit-fail-sync",
                run_id: runId,
                method: "test",
            };

            // Should not throw
            expect(() => server.handleRequest(request)).not.toThrow();
        });

        it("audit log includes error message when handler fails", async () => {
            const runId = `audit-error-${Date.now()}`;
            testRunIds.push(runId);

            const runDir = path.join(process.cwd(), "runs", runId);
            fs.mkdirSync(runDir, { recursive: true });

            const policy = loadPolicy("http");
            policy.allow.push({ method: "fail.test" });

            const server = createServer({ policy, authorize, transport: "http" });
            server.registerDeterministic("fail.test", () => {
                throw new Error("Test failure");
            });

            const request: MCPRequest = {
                id: "fail-1",
                run_id: runId,
                method: "fail.test",
            };

            await server.handleRequest(request);

            const auditPath = path.join(runDir, "mcp", "audit.jsonl");
            const auditContent = fs.readFileSync(auditPath, "utf8");
            const auditRecord = JSON.parse(auditContent.trim());

            expect(auditRecord.ok).toBe(false);
            expect(auditRecord.error).toBe("Test failure");
        });
    });

    describe("registerMethod deprecation", () => {
        it("registerMethod logs deprecation warning", () => {
            const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => { });

            const server = createServer();
            server.registerMethod("test.method", () => ({ ok: true }));

            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining("DEPRECATED: registerMethod()")
            );
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining("Use registerDeterministic()")
            );

            consoleSpy.mockRestore();
        });
    });

    describe("inprocess transport - unknown method", () => {
        it("returns error for unknown method in inprocess transport", () => {
            const server = createServer({ transport: "inprocess" });

            const request: MCPRequest = {
                id: "unknown-inprocess",
                method: "nonexistent.method",
            };

            const response = server.handleRequest(request);

            expect(response.ok).toBe(false);
            expect(response.error?.message).toContain("Unknown method");
        });
    });
});
