import { describe, it, expect } from "vitest";
import {
  isAgentName,
  isStepStatus,
  getCanonicalOutputs,
  validateCanonicalOutputs,
} from "../../index";

describe("core API helpers", () => {
  it("recognizes agent names", () => {
    expect(isAgentName("coordinator")).toBe(true);
    expect(isAgentName("unknown-agent")).toBe(false);
  });

  it("validates step statuses", () => {
    expect(isStepStatus("running")).toBe(true);
    expect(isStepStatus("not-a-status")).toBe(false);
  });

  it("returns canonical output paths", () => {
    expect(getCanonicalOutputs("planner")).toEqual({
      result: "outputs/planner/result.json",
      notes: "outputs/planner/notes.md",
    });
  });

  it("throws when step outputs do not match canonical layout", () => {
    const step = {
      id: "step-1",
      agent: "planner" as const,
      outputs: { result: "wrong", notes: "also-wrong" },
    } as any;
    expect(() => validateCanonicalOutputs(step)).toThrow(
      /Step step-1 outputs must match canonical layout/
    );
  });
});
