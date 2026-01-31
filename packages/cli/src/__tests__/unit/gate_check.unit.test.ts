import path from "path";
import fs from "fs";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { detectGate } from "../../gate_check";

// Mock global fs for default deps coverage
vi.mock("fs", () => ({
  default: {
    existsSync: vi.fn(),
    statSync: vi.fn(),
    readFileSync: vi.fn(),
  },
}));

const normalize = (p: string) => p.split(path.sep).join("/");
const makeFs = (files: Record<string, string>) => ({
  existsSync: (p: string) => normalize(p) in files,
  statSync: (p: string) => ({ isFile: () => normalize(p) in files }),
  readFileSync: (p: string) => files[normalize(p)],
});

describe("gate_check", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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

  it("returns null when index.json is invalid", () => {
    const files = {
      "/run/steps/index.json": "not-json",
    };
    expect(detectGate("/run", { fs: makeFs(files) as any })).toBeNull();
  });

  // NEW: Cover defaultDeps (functions)
  it("uses default fs dependencies when none provided", () => {
    const indexPath = path.join("/run", "steps", "index.json");
    // Mock fs behaviors for this specific test
    vi.mocked(fs.existsSync).mockImplementation((p: any) => p.toString().includes("index.json"));
    vi.mocked(fs.statSync).mockReturnValue({ isFile: () => true } as any);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
      run_id: "run-def",
      steps: [{ step_id: "s1", decision_action: "require_human", step_index: 0 }]
    }));

    // Invoke without deps
    const result = detectGate("/run");

    expect(result).not.toBeNull();
    expect(result?.run_id).toBe("run-def");
    expect(fs.existsSync).toHaveBeenCalledWith(expect.stringContaining("index.json"));
  });

  // NEW: Cover lines 43 and 59-62 branches
  it("handles missing steps array and missing required_inputs", () => {
    // 1. Missing steps array (malformed object) -> line 43 false branch
    const filesNoSteps = {
      "/run/steps/index.json": JSON.stringify({ run_id: "run" }) // no steps
    };
    expect(detectGate("/run", { fs: makeFs(filesNoSteps) as any })).toBeNull();

    // 2. Missing required_inputs in blocked step -> line 59 false branch
    const filesNoReqInputs = {
      "/run/steps/index.json": JSON.stringify({
        run_id: "run-2",
        steps: [{ step_id: "s2", decision_action: "require_human" }] // no required_inputs
      }),
    };
    const result = detectGate("/run", { fs: makeFs(filesNoReqInputs) as any });
    expect(result).not.toBeNull();
    expect(result?.required_inputs).toEqual([]);
    expect(result?.step_id).toBe("s2");
  });

  it("infers run_id from directory name when missing in index", () => {
    const files = {
      "/workspace/runs/run-x/steps/index.json": JSON.stringify({
        steps: [{ step_id: "s1", decision_action: "require_human", step_index: 0 }]
      }),
    };
    const result = detectGate("/workspace/runs/run-x", { fs: makeFs(files) as any });
    expect(result).not.toBeNull();
    expect(result?.run_id).toBe("run-x");
  });
});
