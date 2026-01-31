import path from "path";
import { describe, it, expect } from "vitest";
import { detectGate } from "../../gate_check";

const normalize = (p: string) => p.split(path.sep).join("/");
const makeFs = (files: Record<string, string>) => ({
  existsSync: (p: string) => normalize(p) in files,
  statSync: (p: string) => ({ isFile: () => normalize(p) in files }),
  readFileSync: (p: string) => files[normalize(p)],
});

describe("gate_check", () => {
  it("returns null when index is missing", () => {
    const result = detectGate("/run", { fs: makeFs({}) as any });
    expect(result).toBeNull();
  });

  it("returns null when no gate action present", () => {
    const files = {
      "/run/steps/index.json": JSON.stringify({ run_id: "run", steps: [{ step_id: "s1", decision_action: "continue", step_index: 0 }] }),
    };
    expect(detectGate("/run", { fs: makeFs(files) as any })).toBeNull();
  });

  it("detects gate and builds paths", () => {
    const files = {
      "/run/steps/index.json": JSON.stringify({
        run_id: "run-1",
        steps: [{ step_id: "step-1", agent_name: "planner", decision_action: "require_human", step_index: 0, required_inputs: ["x"] }],
      }),
    };
    const result = detectGate("/run", { fs: makeFs(files) as any });
    expect(result?.run_id).toBe("run-1");
    expect(result?.step_id).toBe("step-1");
    expect(result?.required_inputs).toEqual(["x"]);
    expect(result?.override_path).toContain("override.json");
  });

  it("returns null when override already exists", () => {
    const files = {
      "/run/steps/index.json": JSON.stringify({ run_id: "run", steps: [{ step_id: "s1", decision_action: "require_human", step_index: 0 }] }),
      "/run/outputs/s1/override.json": "{}",
    };
    expect(detectGate("/run", { fs: makeFs(files) as any })).toBeNull();
  });

  it("returns null when step-level override exists", () => {
    const files = {
      "/run/steps/index.json": JSON.stringify({ run_id: "run", steps: [{ step_id: "s1", decision_action: "require_human", step_index: 0 }] }),
      "/run/steps/s1/override.json": "{}",
    };
    expect(detectGate("/run", { fs: makeFs(files) as any })).toBeNull();
  });
});
