import path from "path";
import { describe, it, expect } from "vitest";
import { buildStatusView } from "../../status_view";

const runDir = "/run";
const join = (...p: string[]) => path.join(runDir, ...p);

const makeDeps = (files: Record<string, string>) => ({
  fs: {
    existsSync: (p: string) => p in files,
    statSync: (p: string) => ({ isFile: () => p in files }),
    readFileSync: (p: string) => {
      if (!(p in files)) throw new Error(`Missing ${p}`);
      return files[p];
    },
  },
});

describe("status_view branches", () => {
  it("handles missing run.json and index", () => {
    const files: Record<string, string> = {};
    const view = buildStatusView(runDir, makeDeps(files));
    expect(view).not.toBeNull();
    expect(view?.errors).toContain("MISSING run.json");
    expect(view?.errors).toContain("MISSING steps/index.json");
    expect(view?.overall).toBe("invalid");
  });

  it("handles invalid run.json and missing decision files", () => {
    const files: Record<string, string> = {
      [join("run.json")]: "not-json",
      [join("steps", "index.json")]: JSON.stringify({
        schema_version: "steps-index.v1",
        run_id: "run-id",
        updated_at: "now",
        steps: [{ step_id: "s1", step_index: 0, agent_name: "a", status: "running", decision_action: "continue" }],
      }),
    };
    const view = buildStatusView(runDir, makeDeps(files));
    expect(view?.errors).toContain("INVALID_JSON run.json");
    expect(view?.current_state.is_blocked).toBe(false);
    expect(view?.overall).toBe("invalid");
  });

  it("marks blocked when decision requires human", () => {
    const files: Record<string, string> = {
      [join("run.json")]: JSON.stringify({ run_id: "run-id", status: "running" }),
      [join("steps", "index.json")]: JSON.stringify({
        schema_version: "steps-index.v1",
        run_id: "run-id",
        updated_at: "now",
        steps: [{ step_id: "s1", step_index: 0, agent_name: "a", status: "pending", decision_action: "continue" }],
      }),
      [join("steps", "s1", "effective_decision.json")]: JSON.stringify({ decision: { action: "require_human", reason: "need input" }, requirements: { required_inputs: ["x"] } }),
    };
    const view = buildStatusView(runDir, makeDeps(files));
    expect(view?.current_state.is_blocked).toBe(true);
    expect(view?.current_state.required_inputs).toContain("x");
    expect(view?.current_state.paths.some((p) => p.includes("effective_decision.json"))).toBe(true);
    expect(view?.overall).toBe("in_progress");
  });

  it("marks blocked on failed step and collects paths", () => {
    const files: Record<string, string> = {
      [join("run.json")]: JSON.stringify({ run_id: "run-id", status: "failed", exit_code: 1 }),
      [join("steps", "index.json")]: JSON.stringify({
        schema_version: "steps-index.v1",
        run_id: "run-id",
        updated_at: "now",
        steps: [{ step_id: "s1", step_index: 0, agent_name: "a", status: "failed", decision_action: "continue" }],
      }),
      [join("steps", "s1", "decision_after_step.json")]: JSON.stringify({ decision: { action: "continue", reason: "" } }),
      [join("steps", "s1", "step_result.json")]: JSON.stringify({}),
    };
    const view = buildStatusView(runDir, makeDeps(files));
    expect(view?.current_state.is_blocked).toBe(true);
    expect(view?.current_state.next_action).toBe("inspect_artifacts");
    expect(view?.current_state.paths.some((p) => p.includes("step_result.json"))).toBe(true);
    expect(view?.overall).toBe("finished_failure");
  });
  it("handles read error in readStepsIndex gracefully", () => {
    const deps = makeDeps({});
    deps.fs.existsSync = () => true;
    deps.fs.statSync = () => ({ isFile: () => true }) as any;
    deps.fs.readFileSync = () => { throw new Error("fail"); };
    const view = buildStatusView(runDir, deps);
    expect(view?.errors).toContain("MISSING steps/index.json");
  });

  it("handles read error in readDecision gracefully", () => {
    const files: Record<string, string> = {
      [join("run.json")]: JSON.stringify({ run_id: "run-id", status: "running" }),
      [join("steps", "index.json")]: JSON.stringify({
        schema_version: "steps-index.v1",
        run_id: "run-id",
        steps: [{ step_id: "s1", step_index: 0, agent_name: "a", status: "running", decision_action: "continue" }]
      }),
      [join("steps", "s1", "effective_decision.json")]: "not-json", // trigger error
    };
    // We need to ensure existsSync returns true for effective_decision.json
    const deps = makeDeps(files);
    const view = buildStatusView(runDir, deps);
    expect(view?.overall).toBe("in_progress");
  });

  it("sets next_action to provide_inputs for clarification", () => {
    const files: Record<string, string> = {
      [join("run.json")]: JSON.stringify({ run_id: "run-id", status: "blocked" }),
      [join("steps", "index.json")]: JSON.stringify({
        schema_version: "steps-index.v1",
        run_id: "run-id",
        steps: [{ step_id: "s1", step_index: 0, agent_name: "a", status: "blocked", decision_action: "continue" }]
      }),
      [join("steps", "s1", "decision_after_step.json")]: JSON.stringify({ decision: { action: "request_clarification", reason: "inputs" }, requirements: { required_inputs: ["x"] } }),
    };
    const view = buildStatusView(runDir, makeDeps(files));
    expect(view?.current_state.next_action).toBe("provide_inputs");
  });
});

