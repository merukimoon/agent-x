import { describe, expect, it } from "vitest";
import { applyStatusTransition, isAllowedStatusTransition } from "../status.ts";
import type { Plan, PlanStep, StepStatus } from "../imports.ts";

describe("status helpers", () => {
  const baseStep: PlanStep = {
    id: "step-1",
    agent: "decision-maker",
    depends_on: [],
    inputs: { request: "", context: "", prior_outputs: [] },
    outputs: { result: "", notes: "" },
    status: "pending",
    attempt: 0,
    max_attempts: 1,
    last_error: null,
    allow_skip: true,
  };

  function buildPlan(status: StepStatus): Plan {
    return {
      run_id: "run-1",
      created_at_utc: new Date().toISOString(),
      version: "0.1",
      flow_type: "demo",
      rationale: "status test",
      signals: [],
      confidence: "low",
      steps: [{ ...baseStep, status }],
    };
  }

  it("reports allowed transitions correctly", () => {
    expect(isAllowedStatusTransition("pending", "running")).toBe(true);
    expect(isAllowedStatusTransition("done", "done")).toBe(true);
    expect(isAllowedStatusTransition("failed", "pending")).toBe(true);
    expect(isAllowedStatusTransition("done", "pending")).toBe(false);
  });

  it("persists plan when transition succeeds", () => {
    const plan = buildPlan("pending");
    const persisted: Array<[string, Plan]> = [];
    applyStatusTransition(plan, "step-1", "running", "plan.json", (planPath, updated) => {
      persisted.push([planPath, { ...updated }]);
    }, (step) => {
      step.last_error = "mutated";
    });
    expect(plan.steps[0].status).toBe("running");
    expect(persisted[0]?.[0]).toBe("plan.json");
    expect(persisted[0]?.[1]?.steps[0]?.status).toBe("running");
  });

  it("throws when transition is disallowed", () => {
    const plan = buildPlan("done");
    expect(() => applyStatusTransition(plan, "step-1", "pending", "plan.json", () => {}, () => {})).toThrow(/Invalid status transition/);
  });

  it("throws when step missing", () => {
    const plan = buildPlan("pending");
    expect(() => applyStatusTransition(plan, "missing", "running", "plan.json", () => {})).toThrow(/Step missing/);
  });
});
