import { describe, expect, it, vi } from "vitest";
import type { BufferEncoding } from "node:buffer";
import { authorize } from "../../policy/match";
import { loadPolicy, type LoadPolicyDeps } from "../../policy/loadPolicy";

const emptyEnv = {} as NodeJS.ProcessEnv;

function buildDeps(payload: string): LoadPolicyDeps {
    const readFileSync = vi.fn<[string, BufferEncoding], string>(() => payload);
    const env = {
        ...emptyEnv,
        AGENTX_MCP_POLICY_PATH: "/tmp/custom-policy.json",
    };
    return { env, readFileSync };
}

describe("MCP Policy (unit)", () => {
    it("default policy allows mcp.list_methods over HTTP", () => {
        const policy = loadPolicy("http", { env: emptyEnv });
        const authResult = authorize({
            method: "mcp.list_methods",
            transport: "http",
        }, policy);

        expect(authResult.ok).toBe(true);
    });

    it("default policy allows runner.technical-writer over HTTP", () => {
        const policy = loadPolicy("http", { env: emptyEnv });
        const authResult = authorize({
            method: "runner.technical-writer",
            transport: "http",
        }, policy);

        expect(authResult.ok).toBe(true);
    });

    it("default policy denies unknown method over HTTP", () => {
        const policy = loadPolicy("http", { env: emptyEnv });
        const authResult = authorize({
            method: "unknown.method",
            transport: "http",
        }, policy);

        expect(authResult.ok).toBe(false);
        expect(authResult.reason).toContain("not allowed by policy");
    });

    it("in-process transport bypasses policy", () => {
        const policy = loadPolicy("inprocess", { env: emptyEnv });
        const authResult = authorize({
            method: "any.method.at.all",
            transport: "inprocess",
        }, policy);

        expect(authResult.ok).toBe(true);
    });

    it("custom policy file allows specific method", () => {
        const customPolicy = {
            allow: [
                { method: "custom.method" },
            ],
        };

        const deps = buildDeps(JSON.stringify(customPolicy));
        const policy = loadPolicy("http", deps);
        const authResult = authorize({
            method: "custom.method",
            transport: "http",
        }, policy);

        expect(authResult.ok).toBe(true);
    });

    it("custom policy file denies method not in allowlist", () => {
        const customPolicy = {
            allow: [
                { method: "allowed.method" },
            ],
        };

        const deps = buildDeps(JSON.stringify(customPolicy));
        const policy = loadPolicy("http", deps);
        const authResult = authorize({
            method: "denied.method",
            transport: "http",
        }, policy);

        expect(authResult.ok).toBe(false);
    });
});
