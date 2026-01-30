import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import path from "path";
import { loadPolicy } from "../policy/loadPolicy";

describe("MCP Load Policy", () => {
    let originalPath: string | undefined;
    let tmpDir: string;

    beforeEach(() => {
        originalPath = process.env.AGENTX_MCP_POLICY_PATH;
        tmpDir = path.join(process.cwd(), "runs", `load-policy-test-${Date.now()}`);
        fs.mkdirSync(tmpDir, { recursive: true });
    });

    afterEach(() => {
        if (originalPath !== undefined) {
            process.env.AGENTX_MCP_POLICY_PATH = originalPath;
        } else {
            delete process.env.AGENTX_MCP_POLICY_PATH;
        }
        if (fs.existsSync(tmpDir)) {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        }
    });

    it("returns default policy when no path is configured", () => {
        delete process.env.AGENTX_MCP_POLICY_PATH;
        const policy = loadPolicy("http");

        expect(policy).toBeDefined();
        expect(policy.allow).toBeDefined();
        expect(Array.isArray(policy.allow)).toBe(true);
        expect(policy.allow.length).toBeGreaterThan(0);
    });

    it("returns default policy when path is empty string", () => {
        process.env.AGENTX_MCP_POLICY_PATH = "";
        const policy = loadPolicy("http");

        expect(policy).toBeDefined();
        expect(policy.allow).toBeDefined();
    });

    it("returns default policy when path is whitespace only", () => {
        process.env.AGENTX_MCP_POLICY_PATH = "   ";
        const policy = loadPolicy("http");

        expect(policy).toBeDefined();
        expect(policy.allow).toBeDefined();
    });

    it("throws for HTTP transport when policy file not found", () => {
        process.env.AGENTX_MCP_POLICY_PATH = path.join(tmpDir, "non-existent.json");

        expect(() => loadPolicy("http")).toThrow(/Failed to load MCP policy/);
    });

    it("throws for HTTP transport when policy is invalid JSON", () => {
        const policyPath = path.join(tmpDir, "invalid.json");
        fs.writeFileSync(policyPath, "{ invalid json }", "utf8");
        process.env.AGENTX_MCP_POLICY_PATH = policyPath;

        expect(() => loadPolicy("http")).toThrow(/Failed to load MCP policy/);
    });

    it("throws for HTTP transport when policy is not an object", () => {
        const policyPath = path.join(tmpDir, "not-object.json");
        fs.writeFileSync(policyPath, "\"string\"", "utf8");
        process.env.AGENTX_MCP_POLICY_PATH = policyPath;

        expect(() => loadPolicy("http")).toThrow(/Policy must be an object/);
    });

    it("throws for HTTP transport when policy.allow is not an array", () => {
        const policyPath = path.join(tmpDir, "bad-allow.json");
        fs.writeFileSync(policyPath, JSON.stringify({ allow: "not-array" }), "utf8");
        process.env.AGENTX_MCP_POLICY_PATH = policyPath;

        expect(() => loadPolicy("http")).toThrow(/Policy 'allow' field must be an array/);
    });

    it("returns default policy with warning for inprocess transport when file not found", () => {
        const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => { });
        process.env.AGENTX_MCP_POLICY_PATH = path.join(tmpDir, "non-existent.json");

        const policy = loadPolicy("inprocess");

        expect(policy).toBeDefined();
        expect(policy.allow).toBeDefined();
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Failed to load MCP policy"));
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Using default policy"));

        consoleSpy.mockRestore();
    });

    it("returns default policy with warning for inprocess transport when JSON is invalid", () => {
        const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => { });
        const policyPath = path.join(tmpDir, "invalid.json");
        fs.writeFileSync(policyPath, "{ bad json", "utf8");
        process.env.AGENTX_MCP_POLICY_PATH = policyPath;

        const policy = loadPolicy("inprocess");

        expect(policy).toBeDefined();
        expect(consoleSpy).toHaveBeenCalled();

        consoleSpy.mockRestore();
    });

    it("loads valid custom policy from file", () => {
        const policyPath = path.join(tmpDir, "valid.json");
        const customPolicy = {
            allow: [
                { method: "custom.method.1" },
                { method: "custom.method.2", from: "agent-1", to: "agent-2" },
            ],
        };
        fs.writeFileSync(policyPath, JSON.stringify(customPolicy), "utf8");
        process.env.AGENTX_MCP_POLICY_PATH = policyPath;

        const policy = loadPolicy("http");

        expect(policy.allow).toHaveLength(2);
        expect(policy.allow[0].method).toBe("custom.method.1");
        expect(policy.allow[1].method).toBe("custom.method.2");
    });
});
