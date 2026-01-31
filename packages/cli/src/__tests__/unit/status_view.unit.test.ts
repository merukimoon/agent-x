import path from "path";
import fs from "fs";
import { describe, it, expect, vi } from "vitest";
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

  // Coverage: line 55 (skipped status)
  it("normalizes skipped status correctly", () => {
    const files: Record<string, string> = {
      [join("run.json")]: JSON.stringify({ run_id: "run-id", status: "skipped" }),
      [join("steps", "index.json")]: JSON.stringify({
        schema_version: "steps-index.v1",
        run_id: "run-id",
        steps: []
      }),
    };
    const view = buildStatusView(runDir, makeDeps(files));
    // The view logic doesn't explicitly set "overall" to "skipped" (defaults to incomplete/in_progress?)
    // Let's check what it maps to. "skipped" returns "skipped" from normalize.
    // Line 182 check: running/pending -> in_progress.
    // skipped is not in the list. So it falls to incomplete?
    // Let's check line 175: let overall = "incomplete".
    expect(view?.overall).toBe("incomplete");
  });

  // Coverage: line 100/155 (empty reason), 151 (short-circuit), 180 (failed status)
  it("handles complex blocked scenarios", () => {
    const files: Record<string, string> = {
      [join("run.json")]: JSON.stringify({ run_id: "run-id", status: "failed", exit_code: 1 }),
      [join("steps", "index.json")]: JSON.stringify({
        schema_version: "steps-index.v1",
        run_id: "run-id",
        // Step 1: blocked (action require_human, but empty reason) -> triggers line 100/155
        // Step 2: blocked (should be ignored due to loop short-circuit line 151)
        steps: [
          { step_id: "s1", step_index: 0, agent_name: "a", status: "blocked", decision_action: "continue" },
          { step_id: "s2", step_index: 1, agent_name: "b", status: "blocked", decision_action: "continue" }
        ]
      }),
      // s1 decision: require_human with NO reason (null)
      [join("steps", "s1", "decision_after_step.json")]: JSON.stringify({ decision: { action: "require_human", reason: null } }),
    };
    const view = buildStatusView(runDir, makeDeps(files));

    // Check line 180 (failed status)
    expect(view?.overall).toBe("finished_failure");

    // Check line 155 fallback reason
    expect(view?.current_state.blocked_reason).toBe("decision: require_human");
    expect(view?.current_state.blocked_step_id).toBe("s1");
    // Verify s2 was not processed as blocked (s1 took precedence)
    expect(view?.current_state.is_blocked).toBe(true);
  });

  // Coverage: line 171 (runId fallback)
  it("infers runId from fallback sources", () => {
    const files: Record<string, string> = {
      // run.json missing run_id
      [join("run.json")]: JSON.stringify({ status: "running" }),
      // index also missing run_id
      [join("steps", "index.json")]: JSON.stringify({
        schema_version: "steps-index.v1",
        steps: []
      }),
    };
    // Expected to fall back to path.basename(runDir) -> "run"
    const view = buildStatusView(runDir, makeDeps(files));
    expect(view?.run_id).toBe("run");
  });


  // Coverage: line 180 side branch (exit_code > 0 fallback when status is not failed)
  it("marks failure when exit_code is non-zero even if status is not failed", () => {
    const files: Record<string, string> = {
      [join("run.json")]: JSON.stringify({ run_id: "run-id", status: "done", exit_code: 12 }),
      [join("steps", "index.json")]: JSON.stringify({
        schema_version: "steps-index.v1",
        run_id: "run-id",
        steps: []
      }),
    };
    const view = buildStatusView(runDir, makeDeps(files));
    expect(view?.overall).toBe("finished_failure");
  });

  // Coverage: defaultDeps (lines 13-19)
  it("uses default fs dependencies when none provided", () => {
    // We spy on real fs to force defaultDeps wrappers to execute down the line
    const existsSpy = vi.spyOn(fs, "existsSync").mockReturnValue(true);
    const statSpy = vi.spyOn(fs, "statSync").mockReturnValue({ isFile: () => true } as any);
    // Return a payload that satisfies both "run.json" (status, exit_code) and "steps/index.json" (steps array)
    // because readFileSync will return the same value for both calls.
    const readSpy = vi.spyOn(fs, "readFileSync").mockReturnValue(JSON.stringify({
      run_id: "spy-run",
      status: "done",
      exit_code: 0,
      steps: [],
      schema_version: "steps-index.v1"
    }));

    // Call without deps -> uses defaultDeps -> calls fs.*Sync spies
    const view = buildStatusView("/dummy/path");

    expect(view?.run_id).toBe("spy-run");
    expect(existsSpy).toHaveBeenCalled();
    expect(statSpy).toHaveBeenCalled();
    expect(readSpy).toHaveBeenCalled();

    vi.restoreAllMocks();
  });
});

