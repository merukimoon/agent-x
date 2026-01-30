import { describe, expect, it } from "vitest";
import { matchesRule, authorize } from "../policy/match";
import type { AuthContext, PolicyRule, Policy } from "../policy/policy";

describe("MCP Policy Matching", () => {
    describe("matchesRule", () => {
        it("returns false when method does not match", () => {
            const ctx: AuthContext = {
                method: "method.a",
                transport: "http",
            };
            const rule: PolicyRule = {
                method: "method.b",
            };

            expect(matchesRule(ctx, rule)).toBe(false);
        });

        it("returns true when method matches and no from/to constraints", () => {
            const ctx: AuthContext = {
                method: "test.method",
                transport: "http",
            };
            const rule: PolicyRule = {
                method: "test.method",
            };

            expect(matchesRule(ctx, rule)).toBe(true);
        });

        it("returns true when method matches and from is wildcard", () => {
            const ctx: AuthContext = {
                method: "test.method",
                from: "agent-1",
                transport: "http",
            };
            const rule: PolicyRule = {
                method: "test.method",
                from: "*",
            };

            expect(matchesRule(ctx, rule)).toBe(true);
        });

        it("returns false when from field does not match", () => {
            const ctx: AuthContext = {
                method: "test.method",
                from: "agent-1",
                transport: "http",
            };
            const rule: PolicyRule = {
                method: "test.method",
                from: "agent-2",
            };

            expect(matchesRule(ctx, rule)).toBe(false);
        });

        it("returns true when from field matches exactly", () => {
            const ctx: AuthContext = {
                method: "test.method",
                from: "agent-1",
                transport: "http",
            };
            const rule: PolicyRule = {
                method: "test.method",
                from: "agent-1",
            };

            expect(matchesRule(ctx, rule)).toBe(true);
        });

        it("returns true when method matches and to is wildcard", () => {
            const ctx: AuthContext = {
                method: "test.method",
                to: "agent-2",
                transport: "http",
            };
            const rule: PolicyRule = {
                method: "test.method",
                to: "*",
            };

            expect(matchesRule(ctx, rule)).toBe(true);
        });

        it("returns false when to field does not match", () => {
            const ctx: AuthContext = {
                method: "test.method",
                to: "agent-2",
                transport: "http",
            };
            const rule: PolicyRule = {
                method: "test.method",
                to: "agent-3",
            };

            expect(matchesRule(ctx, rule)).toBe(false);
        });

        it("returns true when to field matches exactly", () => {
            const ctx: AuthContext = {
                method: "test.method",
                to: "agent-2",
                transport: "http",
            };
            const rule: PolicyRule = {
                method: "test.method",
                to: "agent-2",
            };

            expect(matchesRule(ctx, rule)).toBe(true);
        });

        it("returns true when all fields match including from and to", () => {
            const ctx: AuthContext = {
                method: "test.method",
                from: "agent-1",
                to: "agent-2",
                transport: "http",
            };
            const rule: PolicyRule = {
                method: "test.method",
                from: "agent-1",
                to: "agent-2",
            };

            expect(matchesRule(ctx, rule)).toBe(true);
        });
    });

    describe("authorize", () => {
        it("authorizes inprocess transport without policy check", () => {
            const ctx: AuthContext = {
                method: "any.method",
                transport: "inprocess",
            };
            const policy: Policy = {
                allow: [],
            };

            const result = authorize(ctx, policy);

            expect(result.ok).toBe(true);
        });

        it("denies HTTP transport when method is not in policy", () => {
            const ctx: AuthContext = {
                method: "forbidden.method",
                transport: "http",
            };
            const policy: Policy = {
                allow: [
                    { method: "allowed.method" },
                ],
            };

            const result = authorize(ctx, policy);

            expect(result.ok).toBe(false);
            expect(result.reason).toContain("not allowed by policy");
            expect(result.reason).toContain("forbidden.method");
        });

        it("allows HTTP transport when method matches policy", () => {
            const ctx: AuthContext = {
                method: "allowed.method",
                transport: "http",
            };
            const policy: Policy = {
                allow: [
                    { method: "allowed.method" },
                ],
            };

            const result = authorize(ctx, policy);

            expect(result.ok).toBe(true);
        });

        it("denies HTTP transport when method matches but from constraint fails", () => {
            const ctx: AuthContext = {
                method: "test.method",
                from: "wrong-agent",
                transport: "http",
            };
            const policy: Policy = {
                allow: [
                    { method: "test.method", from: "correct-agent" },
                ],
            };

            const result = authorize(ctx, policy);

            expect(result.ok).toBe(false);
        });

        it("denies HTTP transport when method matches but to constraint fails", () => {
            const ctx: AuthContext = {
                method: "test.method",
                to: "wrong-target",
                transport: "http",
            };
            const policy: Policy = {
                allow: [
                    { method: "test.method", to: "correct-target" },
                ],
            };

            const result = authorize(ctx, policy);

            expect(result.ok).toBe(false);
        });
    });
});
