import path from "path";
import { describe, it, expect } from "vitest";
import { getStepDir, getStepResultPath, getDecisionPath, getStepsIndexPath } from "../../paths/steps";

describe("paths helpers", () => {
  it("builds correct directories and files for steps", () => {
    expect(getStepDir("run-1", "step-1")).toBe(path.join("runs", "run-1", "steps", "step-1"));
    expect(getStepResultPath("run-1", "step-1")).toBe(
      path.join("runs", "run-1", "steps", "step-1", "step_result.json")
    );
    expect(getDecisionPath("run-1", "step-1")).toBe(
      path.join("runs", "run-1", "steps", "step-1", "decision_after_step.json")
    );
    expect(getStepsIndexPath("run-1")).toBe(path.join("runs", "run-1", "steps", "index.json"));
  });
});
