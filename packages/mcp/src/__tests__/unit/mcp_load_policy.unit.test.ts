import { describe, expect, it, vi } from "vitest";
import type { BufferEncoding } from "node:buffer";
import { loadPolicy, type LoadPolicyDeps } from "../../policy/loadPolicy";

const baseEnv = {} as NodeJS.ProcessEnv;

function buildDeps(path: string, result: string | (() => string), options?: { throws?: boolean }): LoadPolicyDeps {
    const env = {
        ...baseEnv,
        AGENTX_MCP_POLICY_PATH: path,
    };

    const readFileSync = vi.fn<[string, BufferEncoding], string>(() => {
        if (typeof result === "function") {
            return result();
        }
        return result;
    });

    if (options?.throws) {
        readFileSync.mockImplementation(() => {
            throw new Error("ENOENT: no such file or directory");
        });
    }

    return {
        env,
        readFileSync,
    };
}

describe("MCP Load Policy", () => {
    it("returns default policy when no path is configured", () => {
        const policy = loadPolicy("http", { env: baseEnv });

        expect(policy).toBeDefined();
        expect(Array.isArray(policy.allow)).toBe(true);
        expect(policy.allow.length).toBeGreaterThan(0);
    });

    it("returns default policy when path is empty string", () => {
        const policy = loadPolicy("http", { env: { ...baseEnv, AGENTX_MCP_POLICY_PATH: "" } });

        expect(policy.allow).toBeDefined();
        expect(policy.allow.length).toBeGreaterThan(0);
    });

    it("returns default policy when path is whitespace only", () => {
        const policy = loadPolicy("http", { env: { ...baseEnv, AGENTX_MCP_POLICY_PATH: "   " } });

        expect(policy.allow).toBeDefined();
        expect(policy.allow.length).toBeGreaterThan(0);
    });

    it("throws for HTTP transport when policy file not found", () => {
        const deps = buildDeps("/tmp/missing-policy.json", "", { throws: true });

        expect(() => loadPolicy("http", deps)).toThrow(/Failed to load MCP policy/);
    });

    it("throws for HTTP transport when policy is invalid JSON", () => {
        const deps = buildDeps("/tmp/bad.json", "{ invalid json }");

        expect(() => loadPolicy("http", deps)).toThrow(/Failed to load MCP policy/);
    });

    it("throws for HTTP transport when policy is not an object", () => {
        const deps = buildDeps("/tmp/not-object.json", "\"string\"");

        expect(() => loadPolicy("http", deps)).toThrow(/Policy must be an object/);
    });

    it("throws for HTTP transport when policy.allow is not an array", () => {
        const deps = buildDeps("/tmp/bad-allow.json", JSON.stringify({ allow: "not-array" }));

        expect(() => loadPolicy("http", deps)).toThrow(/Policy 'allow' field must be an array/);
    });

    it("returns default policy with warning for inprocess transport when file not found", () => {
        const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
        const deps = buildDeps("/tmp/missing.json", "", { throws: true });

        const policy = loadPolicy("inprocess", deps);

        expect(policy.allow).toBeDefined();
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Failed to load MCP policy"));
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Using default policy."));

        consoleSpy.mockRestore();
    });

    it("returns default policy with warning for inprocess transport when JSON is invalid", () => {
        const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
        const deps = buildDeps("/tmp/invalid.json", "{ bad json");

        const policy = loadPolicy("inprocess", deps);

        expect(policy.allow).toBeDefined();
        expect(consoleSpy).toHaveBeenCalled();

        consoleSpy.mockRestore();
    });

    it("loads valid custom policy from file", () => {
        const customPolicy = {
            allow: [
                { method: "custom.method.1" },
                { method: "custom.method.2", from: "agent-1", to: "agent-2" },
            ],
        };
        const deps = buildDeps("/tmp/valid.json", JSON.stringify(customPolicy));

        const policy = loadPolicy("http", deps);

        expect(policy.allow).toHaveLength(2);
        expect(policy.allow[0].method).toBe("custom.method.1");
        expect(policy.allow[1].method).toBe("custom.method.2");
    });
});
