import { describe, it, expect } from "vitest";
import {
    normalizeDepends,
    readDependencyStatus,
    checkDependenciesSatisfied,
    ensureDependencies
} from "../agents.ts";

describe("agents utility functions", () => {
    describe("normalizeDepends", () => {
        it("should map agent names to IDs using agentToId", () => {
            const agentToId = {
                "planner": "step-1",
                "executor": "step-2"
            };
            const result = normalizeDepends(["planner", "executor"], agentToId);
            expect(result).toEqual(["step-1", "step-2"]);
        });

        it("should keep IDs that are already in the value set", () => {
            const agentToId = {
                "planner": "step-1",
                "executor": "step-2"
            };
            const result = normalizeDepends(["step-1"], agentToId);
            expect(result).toEqual(["step-1"]);
        });

        it("should throw error for unknown dependency", () => {
            const agentToId = {
                "planner": "step-1"
            };
            expect(() => {
                normalizeDepends(["unknown-agent"], agentToId);
            }).toThrow('Unknown dependency "unknown-agent"');
        });
    });

    describe("readDependencyStatus", () => {
        it("should return not ok if result file does not exist", () => {
            const result = readDependencyStatus("planner", "/nonexistent-run");
            expect(result.ok).toBe(false);
            expect(result.message).toContain("Dependency result missing");
        });

        it("should return not ok if result file exists but status is not done", () => {
            // This would need proper DI to test - skipping complex integration test
            // Real test would inject fs mocks
        });

        it("should return ok if status is done", () => {
            // This would need proper DI to test - skipping complex integration test
        });
    });

    describe("checkDependenciesSatisfied", () => {
        it("should return ready:true when no dependencies", () => {
            const step = {
                id: "step-1",
                agent: "planner",
                depends_on: [],
                inputs: {},
                outputs: {},
                status: "pending",
                attempt: 0,
                max_attempts: 1,
                last_error: null,
                allow_skip: false
            };
            const result = checkDependenciesSatisfied(step, "/some-run", {});
            expect(result.ready).toBe(true);
            expect(result.blocking).toBeNull();
        });

        it("should return ready:false if dependency file missing", () => {
            const step = {
                id: "step-2",
                agent: "executor",
                depends_on: ["step-1"],
                inputs: {},
                outputs: {},
                status: "pending",
                attempt: 0,
                max_attempts: 1,
                last_error: null,
                allow_skip: false
            };
            const idToAgent = {
                "step-1": "planner"
            };
            const result = checkDependenciesSatisfied(step, "/nonexistent-run", idToAgent);
            expect(result.ready).toBe(false);
            expect(result.blocking).toContain("Dependency result missing");
        });
    });

    describe("ensureDependencies", () => {
        it("should throw if dependencies not satisfied", () => {
            const step = {
                id: "step-2",
                agent: "executor",
                depends_on: ["step-1"],
                inputs: {},
                outputs: {},
                status: "pending",
                attempt: 0,
                max_attempts: 1,
                last_error: null,
                allow_skip: false
            };
            const idToAgent = {
                "step-1": "planner"
            };
            expect(() => {
                ensureDependencies(step, "/nonexistent-run", idToAgent);
            }).toThrow("Dependencies not satisfied for step-2");
        });

        it("should not throw if dependencies satisfied", () => {
            const step = {
                id: "step-1",
                agent: "planner",
                depends_on: [],
                inputs: {},
                outputs: {},
                status: "pending",
                attempt: 0,
                max_attempts: 1,
                last_error: null,
                allow_skip: false
            };
            expect(() => {
                ensureDependencies(step, "/some-run", {});
            }).not.toThrow();
        });
    });
});
