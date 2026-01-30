import { describe, expect, it } from "vitest";
import { evaluateGates, resolveStrictness } from "../gating.ts";
import type { StepResult } from "../../../../contracts/src/index.ts";

describe("resolveStrictness", () => {
  const policy = {
    schema_version: "gating-policy.v1" as const,
    system_default: { strictness: "soft" as const },
    pipelines: {
      green: { strictness: "hard" as const },
    },
    agents: {
      "decision-maker": { strictness: "soft" as const },
    },
    steps: {
      "step-1": { strictness: "hard" as const },
    },
  };

  it("prefers step override", () => {
    expect(resolveStrictness(policy as any, { step_id: "step-1", agent_name: "decision-maker", pipeline_id: "green" })).toBe("hard");
  });

  it("falls back to agent override", () => {
    expect(resolveStrictness(policy as any, { agent_name: "decision-maker", pipeline_id: "green" })).toBe("soft");
  });

  it("falls back to pipeline override", () => {
    expect(resolveStrictness(policy as any, { pipeline_id: "green" })).toBe("hard");
  });

  it("uses system default last", () => {
    expect(resolveStrictness(policy as any, {})).toBe("soft");
  });
});

describe("evaluateGates", () => {
  const baseResult = {
    schema_version: "step-result.v1",
    run_id: "run-1",
    step_id: "step-1",
    step_index: 0,
    agent_name: "decision-maker",
    model: { provider: "unknown", name: "n/a", mode: "dry-run", temperature: null },
    timestamps: { started_at: "", finished_at: "", duration_ms: 0 },
    inputs: { context_ref: "", request_ref: "", artifacts_in: [] },
    outputs: { artifacts_out: [], summary_ref: null },
    validation: { hard_checks: [], soft_checks: [] },
    execution: { status: "ok", error: null },
    signals: { matched_keywords: [], confidence: null },
    notes: { warnings: [] },
  } as StepResult;

  it("reports hard_fail when any hard check fails", () => {
    const result = {
      ...baseResult,
      validation: { hard_checks: [{ id: "hard", ok: false, message: "fail" }], soft_checks: [] },
    };
    const outcome = evaluateGates(result, "hard");
    expect(outcome.gate_status).toBe("hard_fail");
    expect(outcome.hard_failed_ids).toContain("hard");
  });

  it("reports soft_fail when only soft checks fail", () => {
    const result = {
      ...baseResult,
      validation: { hard_checks: [], soft_checks: [{ id: "soft", ok: false, message: "fail" }] },
    };
    const outcome = evaluateGates(result, "soft");
    expect(outcome.gate_status).toBe("soft_fail");
    expect(outcome.soft_failed_ids).toEqual(["soft"]);
  });

  it("passes when no checks fail", () => {
    const outcome = evaluateGates(baseResult, "soft");
    expect(outcome.gate_status).toBe("pass");
    expect(outcome.hard_failed_ids).toEqual([]);
    expect(outcome.soft_failed_ids).toEqual([]);
  });

  it("handles missing validation checks gracefully", () => {
    const result = {
      ...baseResult,
      validation: { hard_checks: undefined, soft_checks: null }
    } as any;
    const outcome = evaluateGates(result, "hard");
    expect(outcome.gate_status).toBe("pass");
    expect(outcome.hard_failed_ids).toEqual([]);
  });
});
