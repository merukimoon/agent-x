import path from "path";
import { describe, it, expect } from "vitest";
import { GateCheckDeps, detectGate } from "../../gate_check";

function createDeps(files: Record<string, string>): GateCheckDeps {
  return {
    fs: {
      existsSync: (p: string) => p in files,
      statSync: (p: string) => ({
        isFile: () => p in files,
      }),
      readFileSync: (p: string) => {
        if (!(p in files)) {
          throw new Error(`File not found: ${p}`);
        }
        return files[p];
      },
    },
  };
}

describe("detectGate", () => {
  const runDir = "/tmp/run";
  const indexPath = path.join(runDir, "steps", "index.json");
  const stepDir = path.join(runDir, "steps", "step-1");
  const humanPrompt = path.join(stepDir, "human_prompt.md");
  const decisionAfter = path.join(stepDir, "decision_after_step.json");
  const effectiveDecision = path.join(stepDir, "effective_decision.json");
  const override = path.join(stepDir, "override.json");
  const overrideOutputs = path.join(runDir, "outputs", "coordinator", "override.json");

  const baseIndex = JSON.stringify({
    run_id: "run-123",
    steps: [
      {
        step_id: "step-1",
        step_index: 0,
        agent_name: "coordinator",
        decision_action: "require_human",
        required_inputs: ["context.md"],
      },
    ],
  });

  it("returns gate info when a blocking step is present", () => {
    const files: Record<string, string> = {
      [indexPath]: baseIndex,
      [humanPrompt]: "Please approve.",
      [decisionAfter]: "{}",
      [effectiveDecision]: "{}",
    };
    const gateInfo = detectGate(runDir, createDeps(files));
    expect(gateInfo).toEqual({
      run_id: "run-123",
      step_id: "step-1",
      decision_action: "require_human",
      human_prompt: humanPrompt,
      decision_after: decisionAfter,
      effective_decision: effectiveDecision,
      override_path: override,
      required_inputs: ["context.md"],
    });
  });

  it("returns null when overrides already exist", () => {
    const files: Record<string, string> = {
      [indexPath]: baseIndex,
      [humanPrompt]: "Please approve.",
      [decisionAfter]: "{}",
      [effectiveDecision]: "{}",
      [override]: "{}",
      [overrideOutputs]: "{}",
    };
    const gateInfo = detectGate(runDir, createDeps(files));
    expect(gateInfo).toBeNull();
  });
});
