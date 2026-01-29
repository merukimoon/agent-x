import { describe, it, expect } from "vitest";
import { createGatingRuntime, type GatingRuntimeDeps } from "../gating_runtime.ts";
import type { DecisionAfterStep, StepOverride } from "../../../contracts/src/index.ts";
import type { GatingPolicy, GateOutcome } from "../../../core/src/policy/gating.ts";

describe("gating_runtime", () => {
    describe("loadGatingPolicy", () => {
        it("should return DEFAULT_POLICY when file does not exist", () => {
            const runtime = createGatingRuntime({
                fs: {
                    ...defaultFsMock(),
                    existsSync: () => false,
                },
                env: {},
                cwd: () => "/test",
            });

            const policy = runtime.loadGatingPolicy();
            expect(policy.schema_version).toBe("gating-policy.v1");
            expect(policy.system_default.strictness).toBe("soft");
        });

        it("should return DEFAULT_POLICY when JSON parsing fails", () => {
            const runtime = createGatingRuntime({
                fs: {
                    ...defaultFsMock(),
                    existsSync: () => true,
                    readFileSync: (() => "{ invalid json") as any,
                },
                env: {},
                cwd: () => "/test",
            });

            const policy = runtime.loadGatingPolicy();
            expect(policy.schema_version).toBe("gating-policy.v1");
        });

        it("should return DEFAULT_POLICY when schema_version is not v1", () => {
            const runtime = createGatingRuntime({
                fs: {
                    ...defaultFsMock(),
                    existsSync: () => true,
                    readFileSync: (((() => JSON.stringify({
                        schema_version: "gating-policy.v2",
                        system_default: { strictness: "hard" },
                        pipelines: {},
                        agents: {},
                        steps: {},
                    })) as any)),
                },
                env: {},
                cwd: () => "/test",
            });

            const policy = runtime.loadGatingPolicy();
            expect(policy.schema_version).toBe("gating-policy.v1");
            expect(policy.system_default.strictness).toBe("soft");
        });

        it("should load policy from GATING_POLICY_PATH env if set", () => {
            const runtime = createGatingRuntime({
                fs: {
                    ...defaultFsMock(),
                    existsSync: () => true,
                    readFileSync: (((() => JSON.stringify({
                        schema_version: "gating-policy.v1",
                        system_default: { strictness: "hard" },
                        pipelines: {},
                        agents: {},
                        steps: {},
                    })) as any)),
                },
                env: {
                    GATING_POLICY_PATH: "/custom/policy.json",
                },
                cwd: () => "/test",
            });

            const policy = runtime.loadGatingPolicy();
            expect(policy.system_default.strictness).toBe("hard");
        });

        it("should load policy from config/gating_policy.json if env not set", () => {
            const runtime = createGatingRuntime({
                fs: {
                    ...defaultFsMock(),
                    existsSync: () => true,
                    readFileSync: (((() => JSON.stringify({
                        schema_version: "gating-policy.v1",
                        system_default: { strictness: "hard" },
                        pipelines: {},
                        agents: {},
                        steps: {},
                    })) as any)),
                },
                env: {},
                cwd: () => "/project",
            });

            const policy = runtime.loadGatingPolicy();
            expect(policy.system_default.strictness).toBe("hard");
        });
    });

    describe("readOverride", () => {
        it("should return null if no override files exist", () => {
            const runtime = createGatingRuntime({
                fs: {
                    ...defaultFsMock(),
                    existsSync: () => false,
                },
                cwd: () => "/test",
            });

            const override = runtime.readOverride("run-123", "step-1");
            expect(override).toBeNull();
        });

        it("should return null if path exists but is not a file", () => {
            const runtime = createGatingRuntime({
                fs: {
                    ...defaultFsMock(),
                    existsSync: () => true,
                    statSync: () => ({ isFile: () => false } as any),
                },
                cwd: () => "/test",
            });

            const override = runtime.readOverride("run-123", "step-1");
            expect(override).toBeNull();
        });

        it("should skip candidate with invalid JSON", () => {
            let callCount = 0;
            const runtime = createGatingRuntime({
                fs: {
                    ...defaultFsMock(),
                    existsSync: () => true,
                    statSync: () => ({ isFile: () => true } as any),
                    readFileSync: (() => {
                        callCount++;
                        if (callCount === 1) return "{ invalid";
                        return JSON.stringify({
                            schema_version: "step-override.v1",
                            run_id: "run-123",
                            step_id: "step-1",
                            override_action: "continue",
                            actor: { type: "human", id: "user-1" },
                        });
                    }) as any,
                },
                cwd: () => "/test",
            });

            const override = runtime.readOverride("run-123", "step-1");
            expect(override).toBeTruthy();
            expect(callCount).toBe(2);
        });

        it("should skip candidate with wrong schema_version", () => {
            let callCount = 0;
            const runtime = createGatingRuntime({
                fs: {
                    ...defaultFsMock(),
                    existsSync: () => true,
                    statSync: () => ({ isFile: () => true } as any),
                    readFileSync: (() => {
                        callCount++;
                        if (callCount === 1) {
                            return JSON.stringify({
                                schema_version: "step-override.v2",
                                run_id: "run-123",
                                step_id: "step-1",
                            });
                        }
                        return JSON.stringify({
                            schema_version: "step-override.v1",
                            run_id: "run-123",
                            step_id: "step-1",
                            override_action: "continue",
                            actor: { type: "human", id: "user-1" },
                        });
                    }) as any,
                },
                cwd: () => "/test",
            });

            const override = runtime.readOverride("run-123", "step-1");
            expect(override).toBeTruthy();
            expect(callCount).toBe(2);
        });

        it("should skip candidate with mismatched run_id", () => {
            let callCount = 0;
            const runtime = createGatingRuntime({
                fs: {
                    ...defaultFsMock(),
                    existsSync: () => true,
                    statSync: () => ({ isFile: () => true } as any),
                    readFileSync: (() => {
                        callCount++;
                        if (callCount === 1) {
                            return JSON.stringify({
                                schema_version: "step-override.v1",
                                run_id: "run-999",
                                step_id: "step-1",
                            });
                        }
                        return JSON.stringify({
                            schema_version: "step-override.v1",
                            run_id: "run-123",
                            step_id: "step-1",
                            override_action: "continue",
                            actor: { type: "human", id: "user-1" },
                        });
                    }) as any,
                },
                cwd: () => "/test",
            });

            const override = runtime.readOverride("run-123", "step-1");
            expect(override).toBeTruthy();
            expect(callCount).toBe(2);
        });

        it("should skip candidate with mismatched step_id", () => {
            let callCount = 0;
            const runtime = createGatingRuntime({
                fs: {
                    ...defaultFsMock(),
                    existsSync: () => true,
                    statSync: () => ({ isFile: () => true } as any),
                    readFileSync: (() => {
                        callCount++;
                        if (callCount === 1) {
                            return JSON.stringify({
                                schema_version: "step-override.v1",
                                run_id: "run-123",
                                step_id: "step-999",
                            });
                        }
                        return JSON.stringify({
                            schema_version: "step-override.v1",
                            run_id: "run-123",
                            step_id: "step-1",
                            override_action: "continue",
                            actor: { type: "human", id: "user-1" },
                        });
                    }) as any,
                },
                cwd: () => "/test",
            });

            const override = runtime.readOverride("run-123", "step-1");
            expect(override).toBeTruthy();
            expect(callCount).toBe(2);
        });

        it("should return first valid override found", () => {
            const runtime = createGatingRuntime({
                fs: {
                    ...defaultFsMock(),
                    existsSync: () => true,
                    statSync: () => ({ isFile: () => true } as any),
                    readFileSync: (((() => JSON.stringify({
                        schema_version: "step-override.v1",
                        run_id: "run-123",
                        step_id: "step-1",
                        override_action: "halt",
                        actor: { type: "human", id: "user-1" },
                    })) as any)),
                },
                cwd: () => "/test",
            });

            const override = runtime.readOverride("run-123", "step-1");
            expect(override).toBeTruthy();
            expect(override!.override_action).toBe("halt");
        });
    });

    describe("applyOverride", () => {
        const baseDecision: DecisionAfterStep = {
            schema_version: "decision-after-step.v1",
            run_id: "run-123",
            step_id: "step-1",
            decided_at: "2020-01-01T00:00:00Z",
            decision: {
                action: "require_human",
                reason: "needs review",
            },
            routing: {
                next_agent: null,
                next_model: null,
            },
            requirements: {
                required_inputs: [],
                human_prompt_ref: null,
            },
            constraints: {
                immutable_context: true,
                engine_smartness: "none",
            },
            audit: {
                policy_ids: [],
                rule_ids: [],
            },
        };

        const gateOutcome: GateOutcome = {
            gate_status: "soft_fail",
            hard_failed_ids: [],
            soft_failed_ids: [],
            notes: [],
        };

        it("should return baseDecision if override is null", () => {
            const runtime = createGatingRuntime();
            const result = runtime.applyOverride({
                baseDecision,
                override: null,
                gateOutcome,
            });
            expect(result).toBe(baseDecision);
        });

        it("should return baseDecision if base action is not require_human or request_clarification", () => {
            const runtime = createGatingRuntime();
            const decision = {
                ...baseDecision,
                decision: { action: "continue" as const, reason: "ok" },
            };
            const override: StepOverride = {
                schema_version: "step-override.v1",
                run_id: "run-123",
                step_id: "step-1",
                override_action: "halt",
                actor: { type: "human", id: "user-1" },
                routing_override: null,
                acknowledged_risks: [],
            };

            const result = runtime.applyOverride({
                baseDecision: decision,
                override,
                gateOutcome,
            });
            expect(result).toBe(decision);
        });

        it("should return baseDecision if override action is not allowed", () => {
            const runtime = createGatingRuntime();
            const override: StepOverride = {
                schema_version: "step-override.v1" as const,
                run_id: "run-123",
                step_id: "step-1",
                override_action: "invalid_action" as any,
                actor: { type: "human" as const, id: "user-1" },
                routing_override: null,
                acknowledged_risks: [],
            };

            const result = runtime.applyOverride({
                baseDecision,
                override,
                gateOutcome,
            });
            expect(result).toBe(baseDecision);
        });

        it("should return baseDecision if hard_fail and override is continue", () => {
            const runtime = createGatingRuntime();
            const hardFail: GateOutcome = {
                gate_status: "hard_fail",
                hard_failed_ids: [],
                soft_failed_ids: [],
                notes: [],
            };
            const override: StepOverride = {
                schema_version: "step-override.v1",
                run_id: "run-123",
                step_id: "step-1",
                override_action: "continue",
                actor: { type: "human", id: "user-1" },
                routing_override: null,
                acknowledged_risks: [],
            };

            const result = runtime.applyOverride({
                baseDecision,
                override,
                gateOutcome: hardFail,
            });
            expect(result).toBe(baseDecision);
        });

        it("should apply override for request_clarification base action", () => {
            const runtime = createGatingRuntime();
            const decision = {
                ...baseDecision,
                decision: { action: "request_clarification" as const, reason: "unclear" },
            };
            const override: StepOverride = {
                schema_version: "step-override.v1",
                run_id: "run-123",
                step_id: "step-1",
                override_action: "continue",
                actor: { type: "human", id: "user-1" },
                routing_override: null,
                acknowledged_risks: [],
            };

            const result = runtime.applyOverride({
                baseDecision: decision,
                override,
                gateOutcome,
            });
            expect(result.decision.action).toBe("continue");
            expect(result.decision.reason).toContain("override by human:user-1");
        });

        it("should use routing_override if provided", () => {
            const runtime = createGatingRuntime();
            const override: StepOverride = {
                schema_version: "step-override.v1",
                run_id: "run-123",
                step_id: "step-1",
                override_action: "continue",
                actor: { type: "human", id: "user-1" },
                routing_override: {
                    next_agent: "executor",
                    next_model: null,
                },
                acknowledged_risks: [],
            };

            const result = runtime.applyOverride({
                baseDecision,
                override,
                gateOutcome,
            });
            expect(result.routing.next_agent).toBe("executor");
        });

        it("should keep base routing if routing_override not provided", () => {
            const runtime = createGatingRuntime();
            const decision = {
                ...baseDecision,
                routing: { next_agent: "original", next_model: null },
            };
            const override: StepOverride = {
                schema_version: "step-override.v1",
                run_id: "run-123",
                step_id: "step-1",
                override_action: "halt",
                actor: { type: "human", id: "user-1" },
                routing_override: null,
                acknowledged_risks: [],
            };

            const result = runtime.applyOverride({
                baseDecision: decision,
                override,
                gateOutcome,
            });
            expect(result.routing.next_agent).toBe("original");
        });
    });
});

// Helper to create default mock fs
function defaultFsMock(): GatingRuntimeDeps["fs"] {
    return {
        existsSync: () => true,
        readFileSync: (() => "{}") as any,
        statSync: () => ({ isFile: () => true } as any),
    };
}
