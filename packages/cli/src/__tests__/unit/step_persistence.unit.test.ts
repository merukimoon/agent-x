import { describe, it, expect, vi, beforeEach } from "vitest";
import path from "path";
import { createStepPersistence, StepPersistenceDeps } from "../../step_persistence";

const normalizePath = (value: string | Buffer | URL) => value.toString().split(path.sep).join("/");

const makeFakeDeps = (): { deps: Partial<StepPersistenceDeps>; files: Record<string, string> } => {
  const files: Record<string, string> = {};
  const fsOps = {
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn((filePath, data) => {
      const normalized = normalizePath(filePath);
      files[normalized] = data.toString();
    }),
    readFileSync: vi.fn((filePath) => {
      const normalized = normalizePath(filePath);
      if (!(normalized in files)) {
        throw new Error("missing");
      }
      return files[normalized];
    }),
    existsSync: vi.fn((filePath) => normalizePath(filePath) in files),
    statSync: vi.fn((filePath) => ({ isFile: () => normalizePath(filePath) in files })),
    openSync: vi.fn(() => 1),
    fsyncSync: vi.fn(),
    closeSync: vi.fn(),
    renameSync: vi.fn((from, to) => {
      const src = normalizePath(from);
      const dest = normalizePath(to);
      files[dest] = files[src];
      delete files[src];
    }),
  };
  const deps: Partial<StepPersistenceDeps> = {
    fs: fsOps,
    process: { pid: 42 },
    now: () => 123,
  };
  return { deps, files };
};

describe("step persistence helpers", () => {
  let context: ReturnType<typeof makeFakeDeps>;

  beforeEach(() => {
    context = makeFakeDeps();
  });

  it("writes JSON atomically", () => {
    const persistence = createStepPersistence(context.deps);
    persistence.writeJsonAtomic("runs/run/test.json", { value: 1 });
    const parsed = JSON.parse(context.files[normalizePath("runs/run/test.json")]);
    expect(parsed.value).toBe(1);
  });

  it("ignores fsync errors other than allowed", () => {
    const { deps, files } = makeFakeDeps();
    deps.fs = {
      ...deps.fs,
      fsyncSync: () => {
        const err: any = new Error("nope");
        err.code = "EINVAL";
        throw err;
      },
    } as any;
    const persistence = createStepPersistence(deps);
    persistence.writeJsonAtomic("runs/run/test.json", { ok: true });
    expect(JSON.parse(files[normalizePath("runs/run/test.json")]).ok).toBe(true);
  });

  it("reads JSON or returns null", () => {
    const persistence = createStepPersistence(context.deps);
    expect(persistence.readJson("missing")).toBeNull();
    persistence.writeJsonAtomic("runs/run/sample.json", { ok: true });
    expect(persistence.readJson("runs/run/sample.json")).toEqual({ ok: true });
    context.files[normalizePath("runs/run/bad.json")] = "not-json";
    expect(persistence.readJson("runs/run/bad.json")).toBeNull();
  });

  it("writes step result, decision, and updates index", () => {
    const persistence = createStepPersistence(context.deps);
    const stepResult = {
      schema_version: "step-result.v1",
      run_id: "run-1",
      step_id: "step-1",
      step_index: 0,
      agent_name: "planner",
      model: { provider: "unknown", name: "unknown", mode: "dry-run", temperature: null },
      timestamps: { started_at: new Date().toISOString(), finished_at: new Date().toISOString(), duration_ms: 1 },
      inputs: { context_ref: "inputs/context.md", request_ref: "inputs/request.md", artifacts_in: [] },
      outputs: { artifacts_out: [], summary_ref: null },
      validation: { hard_checks: [], soft_checks: [] },
      execution: { status: "ok", error: null },
      signals: { matched_keywords: [], confidence: null },
      notes: { warnings: [] },
    };
    persistence.writeStepResult("run-1", "step-1", stepResult);
    const stepResultParsed = JSON.parse(context.files[normalizePath(path.join("runs", "run-1", "steps", "step-1", "step_result.json"))]);
    expect(stepResultParsed.step_id).toBe("step-1");

    const decision = {
      schema_version: "decision-after-step.v1",
      run_id: "run-1",
      step_id: "step-1",
      decided_at: new Date().toISOString(),
      decision: { action: "continue", reason: "looks good" },
      routing: { next_agent: null, next_model: null },
      requirements: { required_inputs: [], human_prompt_ref: null },
      constraints: { immutable_context: true, engine_smartness: "none" },
      audit: { policy_ids: ["gating-policy.v1"], rule_ids: [] },
    };
    persistence.writeDecision("run-1", "step-1", decision);
    const decisionParsed = JSON.parse(context.files[normalizePath(path.join("runs", "run-1", "steps", "step-1", "decision_after_step.json"))]);
    expect(decisionParsed.step_id).toBe("step-1");
  });

  it("updates steps index by replacing entries", () => {
    const persistence = createStepPersistence(context.deps);
    context.files["runs/run-1/steps/index.json"] = JSON.stringify({
      schema_version: "steps-index.v1",
      run_id: "run-1",
      updated_at: "now",
      steps: [{ step_id: "step-1", step_index: 0, agent_name: "planner", status: "done", decision_action: "continue", model: { provider: "unknown", name: "unknown" }, duration_ms: 10 }],
    });
    persistence.updateStepsIndex({
      runId: "run-1",
      entry: {
        step_id: "step-1",
        step_index: 0,
        agent_name: "planner",
        status: "done",
        decision_action: "continue",
        model: { provider: "unknown", name: "unknown", mode: "dry-run", temperature: null },
        duration_ms: 5,
      },
    });
    const updated = JSON.parse(context.files[normalizePath(path.join("runs", "run-1", "steps", "index.json"))]);
    expect(updated.steps[0].duration_ms).toBe(5);
  });

  it("writes skipped artifacts and decision chain", () => {
    const persistence = createStepPersistence(context.deps);
    persistence.writeSkippedStepArtifacts({
      runId: "run-1",
      stepId: "step-1",
      stepIndex: 0,
      agentName: "planner",
      reason: { code: "dry_run", message: "skip", at_utc: new Date().toISOString() },
      outputsDir: "runs/run-1/outputs/planner",
      mode: "dry-run",
    });
    const resultParsed = JSON.parse(context.files[normalizePath(path.join("runs", "run-1", "outputs", "planner", "result.json"))]);
    expect(resultParsed.status).toBe("skipped");
    expect(JSON.parse(context.files[normalizePath(path.join("runs", "run-1", "outputs", "planner", "status.json"))]).agent).toBe("planner");
    expect(context.files["runs/run-1/steps/step-1/decision_after_step.json"]).toBeDefined();
  });
});
