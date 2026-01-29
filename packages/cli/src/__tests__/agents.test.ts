import { describe, it, expect, vi } from "vitest";
import type { ExecutionMode, PlanStep } from "../imports.ts";
import type { SkipReasonCode } from "../../../contracts/src/index.ts";
import {
    normalizeStatusLocal,
    buildSkipReason,
    deriveSkipReason,
    normalizeDepends,
    readDependencyStatus,
    checkDependenciesSatisfied,
    ensureDependencies,
} from "../agents.ts";

describe("agents utility functions", () => {
    describe("normalizeStatusLocal", () => {
        it('should return "skipped" for "skipped"', () => {
            expect(normalizeStatusLocal("skipped")).toBe("skipped");
            expect(normalizeStatusLocal("SKIPPED")).toBe("skipped");
            expect(normalizeStatusLocal(" Skipped ")).toBe("skipped");
        });

        it('should return "failed" for "failed"', () => {
            expect(normalizeStatusLocal("failed")).toBe("failed");
            expect(normalizeStatusLocal("FAILED")).toBe("failed");
        });

        it('should return "done" for done/success/ok variants', () => {
            expect(normalizeStatusLocal("done")).toBe("done");
            expect(normalizeStatusLocal("success")).toBe("done");
            expect(normalizeStatusLocal("ok")).toBe("done");
            expect(normalizeStatusLocal("OK")).toBe("done");
        });

        it('should return "running" for running/in_progress variants', () => {
            expect(normalizeStatusLocal("running")).toBe("running");
            expect(normalizeStatusLocal("in_progress")).toBe("running");
            expect(normalizeStatusLocal("RUNNING")).toBe("running");
        });

        it('should return "pending" for "pending"', () => {
            expect(normalizeStatusLocal("pending")).toBe("pending");
            expect(normalizeStatusLocal("PENDING")).toBe("pending");
        });

        it('should return "pending" for undefined/null/empty', () => {
            expect(normalizeStatusLocal(undefined)).toBe("pending");
            expect(normalizeStatusLocal(null)).toBe("pending");
            expect(normalizeStatusLocal("")).toBe("pending");
        });

        it('should return "pending" for unknown values', () => {
            expect(normalizeStatusLocal("unknown")).toBe("pending");
            expect(normalizeStatusLocal("xyz")).toBe("pending");
        });
    });

    describe("buildSkipReason", () => {
        // Mock Date.now for deterministic testing
        const mockDate = new Date("2024-01-01T12:00:00.000Z");
        const originalDate = global.Date;

        beforeEach(() => {
            global.Date = class extends originalDate {
                constructor() {
                    super();
                    return mockDate;
                }
                static now() {
                    return mockDate.getTime();
                }
            } as any;
        });

        afterEach(() => {
            global.Date = originalDate;
        });

        it("should use valid code from ALLOWED list", () => {
            const result = buildSkipReason("dry_run", "Test message");
            expect(result.code).toBe("dry_run");
            expect(result.message).toBe("Test message");
        });

        it("should default to policy_disabled for invalid code", () => {
            const result = buildSkipReason("invalid_code" as SkipReasonCode, "Test");
            expect(result.code).toBe("policy_disabled");
        });

        it("should use provided message when non-empty", () => {
            const result = buildSkipReason("dry_run", "  Custom message  ");
            expect(result.message).toBe("Custom message");
        });

        it("should use default message template when message is empty", () => {
            const result1 = buildSkipReason("dry_run", "");
            expect(result1.message).toBe("Skipped (dry_run)");

            const result2 = buildSkipReason("not_applicable", "   ");
            expect(result2.message).toBe("Skipped (not_applicable)");
        });

        it("should include timestamp", () => {
            const result = buildSkipReason("dry_run", "Test");
            expect(result.at_utc).toBe("2024-01-01T12:00:00.000Z");
        });

        it("should handle all valid codes", () => {
            const codes: SkipReasonCode[] = ["dry_run", "not_applicable", "precondition_unmet", "policy_disabled"];
            codes.forEach((code) => {
                const result = buildSkipReason(code, "Test");
                expect(result.code).toBe(code);
            });
        });
    });

    describe("deriveSkipReason", () => {
        const mockDate = new Date("2024-01-01T12:00:00.000Z");
        const originalDate = global.Date;

        beforeEach(() => {
            global.Date = class extends originalDate {
                constructor() {
                    super();
                    return mockDate;
                }
            } as any;
        });

        afterEach(() => {
            global.Date = originalDate;
        });

        it('should use "dry_run" code for dry-run mode', () => {
            const step: PlanStep = {
                id: "step-1",
                agent: "planner",
                depends_on: [],
                inputs: { request: "", context: "", prior_outputs: [] },
                outputs: { result: "", notes: "" },
                status: "skipped",
                attempt: 0,
                max_attempts: 1,
                last_error: null,
                allow_skip: true,
            };
            const result = deriveSkipReason({ step, mode: "dry-run" });
            expect(result.code).toBe("dry_run");
        });

        it('should use "not_applicable" code for non-dry-run mode', () => {
            const step: PlanStep = {
                id: "step-1",
                agent: "planner",
                depends_on: [],
                inputs: { request: "", context: "", prior_outputs: [] },
                outputs: { result: "", notes: "" },
                status: "skipped",
                attempt: 0,
                max_attempts: 1,
                last_error: null,
                allow_skip: true,
            };
            const result = deriveSkipReason({ step, mode: "execute" as ExecutionMode });
            expect(result.code).toBe("not_applicable");
        });

        it("should use step.last_error as message when present", () => {
            const step: PlanStep = {
                id: "step-1",
                agent: "planner",
                depends_on: [],
                inputs: { request: "", context: "", prior_outputs: [] },
                outputs: { result: "", notes: "" },
                status: "skipped",
                attempt: 0,
                max_attempts: 1,
                last_error: "Custom error message",
                allow_skip: true,
            };
            const result = deriveSkipReason({ step, mode: "dry-run" });
            expect(result.message).toBe("Custom error message");
        });

        it('should use "Skipped by policy" as fallback message', () => {
            const step: PlanStep = {
                id: "step-1",
                agent: "planner",
                depends_on: [],
                inputs: { request: "", context: "", prior_outputs: [] },
                outputs: { result: "", notes: "" },
                status: "skipped",
                attempt: 0,
                max_attempts: 1,
                last_error: null,
                allow_skip: true,
            };
            const result = deriveSkipReason({ step, mode: "dry-run" });
            expect(result.message).toBe("Skipped by policy");
        });
    });

    describe("normalizeDepends", () => {
        it("should map agent names to IDs using agentToId", () => {
            const agentToId = {
                planner: "step-1",
                executor: "step-2",
            };
            const result = normalizeDepends(["planner", "executor"], agentToId);
            expect(result).toEqual(["step-1", "step-2"]);
        });

        it("should keep IDs that are already in the value set", () => {
            const agentToId = {
                planner: "step-1",
                executor: "step-2",
            };
            const result = normalizeDepends(["step-1"], agentToId);
            expect(result).toEqual(["step-1"]);
        });

        it("should handle mixed agent names and IDs", () => {
            const agentToId = {
                planner: "step-1",
                executor: "step-2",
            };
            const result = normalizeDepends(["planner", "step-2"], agentToId);
            expect(result).toEqual(["step-1", "step-2"]);
        });

        it("should throw error for unknown dependency", () => {
            const agentToId = {
                planner: "step-1",
            };
            expect(() => {
                normalizeDepends(["unknown-agent"], agentToId);
            }).toThrow('Unknown dependency "unknown-agent"');
        });

        it("should handle empty dependency list", () => {
            const agentToId = {
                planner: "step-1",
            };
            const result = normalizeDepends([], agentToId);
            expect(result).toEqual([]);
        });
    });

    describe("readDependencyStatus", () => {
        it("should return not ok if result file does not exist", () => {
            const result = readDependencyStatus("planner", "/nonexistent-run");
            expect(result.ok).toBe(false);
            expect(result.message).toContain("Dependency result missing");
            expect(result.message).toContain("planner");
        });

        it("should return not ok for non-file paths", () => {
            // Test will hit the statSync isFile check for existing directories
            const result = readDependencyStatus("planner", ".");
            expect(result.ok).toBe(false);
            expect(result.message).toContain("Dependency result missing");
        });
    });

    describe("checkDependenciesSatisfied", () => {
        const createStep = (depends_on: string[]) => ({
            id: "step-2",
            agent: "executor",
            depends_on,
            inputs: { request: "", context: "", prior_outputs: [] },
            outputs: { result: "", notes: "" },
            status: "pending",
            attempt: 0,
            max_attempts: 1,
            last_error: null,
            allow_skip: false,
        });

        it("should return ready:true when no dependencies", () => {
            const step = createStep([]);
            const result = checkDependenciesSatisfied(step, "/some-run", {});
            expect(result.ready).toBe(true);
            expect(result.blocking).toBeNull();
        });

        it("should return ready:false if dependency file missing", () => {
            const step = createStep(["step-1"]);
            const idToAgent = {
                "step-1": "planner",
            };
            const result = checkDependenciesSatisfied(step, "/nonexistent-run", idToAgent);
            expect(result.ready).toBe(false);
            expect(result.blocking).toContain("Dependency result missing");
        });

        it("should use dep as agent name when idToAgent mapping missing", () => {
            const step = createStep(["planner"]);
            const result = checkDependenciesSatisfied(step, "/nonexistent-run", {});
            expect(result.ready).toBe(false);
            expect(result.blocking).toContain("planner");
        });
    });

    describe("ensureDependencies", () => {
        const createStep = (depends_on: string[]) => ({
            id: "step-2",
            agent: "executor",
            depends_on,
            inputs: { request: "", context: "", prior_outputs: [] },
            outputs: { result: "", notes: "" },
            status: "pending",
            attempt: 0,
            max_attempts: 1,
            last_error: null,
            allow_skip: false,
        });

        it("should throw if dependencies not satisfied", () => {
            const step = createStep(["step-1"]);
            const idToAgent = {
                "step-1": "planner",
            };
            expect(() => {
                ensureDependencies(step, "/nonexistent-run", idToAgent);
            }).toThrow("Dependencies not satisfied for step-2");
        });

        it("should not throw if dependencies satisfied (no deps)", () => {
            const step = createStep([]);
            expect(() => {
                ensureDependencies(step, "/some-run", {});
            }).not.toThrow();
        });

        it("should include blocking message in error", () => {
            const step = createStep(["step-1"]);
            const idToAgent = { "step-1": "planner" };
            try {
                ensureDependencies(step, "/nonexistent", idToAgent);
                expect.fail("Should have thrown");
            } catch (error: any) {
                expect(error.message).toContain("Dependencies not satisfied");
                expect(error.message).toContain("step-2");
            }
        });
    });
});
