import fs from "fs";
import path from "path";
import { describe, it, expect, vi, afterEach, beforeEach, type Mock } from "vitest";
import * as agents from "../../agents";
import * as stepPersistence from "../../step_persistence";
import { Legacy, Core, Runners } from "../../imports";
import * as gatingRuntime from "../../gating_runtime";
import * as rolesRegistry from "../../../../../scripts/agentic/roles_registry";



describe("agents helpers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("normalizes statuses to canonical buckets", () => {
    expect(agents.normalizeStatusLocal("SKIPPED")).toBe("skipped");
    expect(agents.normalizeStatusLocal("running")).toBe("running");
    expect(agents.normalizeStatusLocal("unknown")).toBe("pending");
  });

  it("builds skip reasons with fallback messaging", () => {
    const reason = agents.buildSkipReason("dry_run", "");
    expect(reason.code).toBe("dry_run");
    expect(reason.message).toContain("Skipped");
  });

  it("derives dry run skip reason", () => {
    const step = { last_error: "boom" } as any;
    const result = agents.deriveSkipReason({ step, mode: "dry-run" });
    expect(result.code).toBe("dry_run");
    expect(result.message).toContain("boom");
  });

  it("normalizes dependencies via mapping", () => {
    const run = { planner: "planner", coordinator: "coordinator" };
    const result = agents.normalizeDepends(["planner", "coordinator"], run);
    expect(result).toEqual(["planner", "coordinator"]);
    expect(() => agents.normalizeDepends(["unknown"], run)).toThrow(/Unknown dependency/);
  });

  it("checks dependency status against filesystem", () => {
    const normalizeFilePath = (value: string | Buffer | URL) => value.toString().split(path.sep).join("/");
    const resultPath = normalizeFilePath(path.join("runs", "run-1", "outputs", "planner", "result.json"));
    const files: Record<string, string> = {
      [resultPath]: JSON.stringify({ status: "done" }),
    };
    vi.spyOn(fs, "existsSync").mockImplementation((p) => Boolean(files[normalizeFilePath(p.toString())]));
    vi.spyOn(fs, "statSync").mockImplementation(() => ({ isFile: () => true } as any));
    vi.spyOn(fs, "readFileSync").mockImplementation((p) => files[normalizeFilePath(p.toString())] ?? "null");
    const status = agents.readDependencyStatus("planner", "runs/run-1");
    expect(status.ok).toBe(true);
    vi.spyOn(fs, "readFileSync").mockImplementation(() => {
      throw new Error("bad");
    });
    const errorStatus = agents.readDependencyStatus("planner", "runs/run-1");
    expect(errorStatus.ok).toBe(false);
  });

  it("throws when dependencies not ready", () => {
    const stub = vi.spyOn(agents, "readDependencyStatus").mockReturnValue({ ok: false, message: "blocked" });
    expect(() =>
      agents.ensureDependencies({ depends_on: ["planner"] } as any, "run", { planner: "planner" })
    ).toThrow(/Dependencies not satisfied/);
    stub.mockRestore();
  });

  it("ensures skipped artifacts are written", () => {
    const spy = vi.spyOn(stepPersistence, "writeSkippedStepArtifacts").mockImplementation(() => { });
    const plan = {
      steps: [
        { id: "step-1", agent: "planner", status: "skipped", last_error: null },
        { id: "step-2", agent: "coordinator", status: "done" },
      ],
    } as any;
    vi.spyOn(fs, "existsSync").mockImplementation((p) => p.toString().includes("status.json"));
    vi.spyOn(fs, "readFileSync").mockReturnValue(
      JSON.stringify({ reason: { code: "dry_run", message: "cached" } })
    );
    agents.ensureSkippedArtifactsForPlan("run-1", plan, "dry-run", { cwd: () => "/tmp" });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("detects missing inputs and honors forced overrides", () => {
    const normalize = (p: string) => p.split(path.sep).join("/");
    const files: Record<string, string> = {
      "/run/inputs/request.md": "req",
    };
    const fsOps = {
      existsSync: (p: string) => normalize(p) in files,
      statSync: (p: string) => ({ isFile: () => normalize(p) in files }),
      readFileSync: (p: string) => files[normalize(p)],
      mkdirSync: vi.fn(),
    } as any;
    const missing = agents.detectMissingInputs(
      "/run",
      { context_ref: "inputs/context.md", request_ref: "inputs/request.md", artifacts_in: ["a.txt"] },
      { fs: fsOps, env: { FORCE_MISSING_INPUTS: "extra1,extra2" } }
    );
    expect(missing).toEqual(["inputs/context.md", "a.txt", "extra1", "extra2"]);
  });

  it("returns dependency not-done status", () => {
    const fsOps = {
      existsSync: () => true,
      statSync: () => ({ isFile: () => true }),
      readFileSync: () => JSON.stringify({ status: "running" }),
    } as any;
    const status = agents.readDependencyStatus("planner", "/run", { fs: fsOps });
    expect(status.ok).toBe(false);
    expect(status.message).toContain("running");
  });

  it("resolveStepMeta reads plan when present", () => {
    const fsOps = {
      existsSync: () => true,
      statSync: () => ({ isFile: () => true }),
      readFileSync: () => JSON.stringify({ flow_type: "ft", steps: [{ id: "s1", agent: "planner", inputs: { prior_outputs: ["a"] } }] }),
    } as any;
    const meta = agents.resolveStepMeta("/run", "planner", { fs: fsOps });
    expect(meta.stepId).toBe("s1");
    expect(meta.pipelineId).toBe("ft");
    expect(meta.priorOutputs).toEqual(["a"]);
  });

  it("resolveStepMeta ignores malformed plan", () => {
    const fsOps = {
      existsSync: () => true,
      statSync: () => ({ isFile: () => true }),
      readFileSync: () => "not-json",
    } as any;
    const meta = agents.resolveStepMeta("/run", "planner", { fs: fsOps });
    expect(meta.stepId).toBe("planner");
  });


});

describe("agents runAgent scenarios", () => {
  const normalize = (p: string) => p.split(path.sep).join("/");

  const makeDeps = (initial: Record<string, string>) => {
    const files = { ...initial };
    const fsOps = {
      existsSync: (p: string) => normalize(p) in files,
      statSync: (p: string) => ({ isFile: () => normalize(p) in files }),
      readFileSync: (p: string) => files[normalize(p)],
      writeFileSync: (p: string, data: string) => {
        files[normalize(p)] = data;
      },
      mkdirSync: vi.fn(),
    } as any;
    const deps: Partial<agents.AgentsDeps> = {
      fs: fsOps,
      env: {},
      cwd: () => "/workspace",
    };
    return { deps, files };
  };

  beforeEach(() => {
    vi.spyOn(rolesRegistry, "requireExecutableRole").mockReturnValue({ runner: "mock-runner" } as any);
    vi.spyOn(Core, "getCanonicalOutputs").mockImplementation((agent: string) => ({
      result: `outputs/${agent}/result.json`,
      notes: `outputs/${agent}/notes.md`,
    }));
    vi.spyOn(Legacy, "ensureRunAndInputs").mockImplementation(() => { });
    vi.spyOn(Legacy, "readFirstLines").mockReturnValue(["excerpt"] as any);
    vi.spyOn(Legacy, "writeFileAtomic").mockImplementation(() => { });
    vi.spyOn(Legacy, "writeJsonFile").mockImplementation(() => { });
    vi.spyOn(Legacy, "readFileText").mockReturnValue("text");
    vi.spyOn(Legacy, "classifyFlow").mockReturnValue({
      signals: ["keyword:sec"],
      confidence: 1,
      pack: { flow_type: "type", steps: [] },
    } as any);
    vi.spyOn(gatingRuntime, "loadGatingPolicy").mockReturnValue({ system_default: { strictness: "soft" } } as any);
    vi.spyOn(gatingRuntime, "determineStrictness").mockReturnValue("soft" as any);
    vi.spyOn(gatingRuntime, "evaluateStepGates").mockReturnValue({ gate_status: "pass", hard_failed_ids: [], soft_failed_ids: [], notes: [] } as any);
    vi.spyOn(gatingRuntime, "readOverride").mockReturnValue(null);
    vi.spyOn(gatingRuntime, "applyOverride").mockImplementation(({ baseDecision }) => baseDecision as any);
    vi.spyOn(gatingRuntime, "writeEffectiveDecision").mockImplementation(() => { });
    vi.spyOn(stepPersistence, "writeStepResult").mockImplementation(() => { });
    vi.spyOn(stepPersistence, "writeDecision").mockImplementation(() => { });
    vi.spyOn(stepPersistence, "updateStepsIndex").mockImplementation(() => { });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("runs planner happy path with injected deps", () => {
    const { deps, files } = makeDeps({
      "/workspace/runs/run-1/inputs/request.md": "req",
      "/workspace/runs/run-1/inputs/context.md": "ctx",
    });
    files["/workspace/runs/run-1/planner_llm_target.json"] = JSON.stringify({ provider: "p", model: "m" });
    const result = agents.runAgent("planner", "run-1", "dry-run", null, deps);
    expect(result.status).toBe("done");
    expect(stepPersistence.writeStepResult).toHaveBeenCalled();
    expect(stepPersistence.writeDecision).toHaveBeenCalled();
    expect(gatingRuntime.applyOverride).toHaveBeenCalled();
    expect(result.provider).toBe("p");
    const writeCalls = (Legacy.writeJsonFile as any as Mock).mock.calls.map((c: any[]) => normalize(c[0]));
    expect(writeCalls.some((p) => p.endsWith("outputs/planner/result.json"))).toBe(true);
  });

  it("requests clarification when inputs are missing", () => {
    const { deps } = makeDeps({
      "/workspace/runs/run-1/inputs/request.md": "req",
    });
    const decisionSpy = vi.spyOn(stepPersistence, "writeDecision");
    agents.runAgent("planner", "run-1", "dry-run", null, deps);
    const decisionPayload = decisionSpy.mock.calls[0][2] ?? decisionSpy.mock.calls[0][1];
    expect(JSON.stringify(decisionPayload)).toContain("missing inputs");
  });

  it("switches summaries between dry-run and live", () => {
    const { deps } = makeDeps({
      "/workspace/runs/run-1/inputs/request.md": "req",
      "/workspace/runs/run-1/inputs/context.md": "ctx",
    });
    const dry = agents.runAgent("planner", "run-1", "dry-run", null, deps);
    const live = agents.runAgent("planner", "run-1", "live", null, deps);
    expect(dry.summary?.toLowerCase()).toContain("dry run");
    expect(live.summary?.toLowerCase()).toContain("run complete");
  });

  it("handles plan metadata parse failures gracefully", () => {
    const { deps } = makeDeps({
      "/workspace/runs/run-1/plan.json": "not-json",
      "/workspace/runs/run-1/inputs/request.md": "req",
      "/workspace/runs/run-1/inputs/context.md": "ctx",
    });
    expect(() => agents.runAgent("planner", "run-1", "dry-run", null, deps)).not.toThrow();
  });

  it("builds coordinator plan with matched signals and skips disabled steps", () => {
    vi.spyOn(Legacy, "classifyFlow").mockReturnValue({
      signals: ["keyword:block"],
      confidence: 0.5,
      pack: {
        flow_type: "security",
        steps: [
          { id: "s1", agent: "a1", depends_on: [], outputs: {}, enabled_if_keywords: ["block"] },
          { id: "s2", agent: "a2", depends_on: ["s1"], outputs: {}, enabled_if_keywords: ["none"] },
        ],
      },
    } as any);
    const { deps } = makeDeps({
      "/workspace/runs/run-1/inputs/request.md": "req",
      "/workspace/runs/run-1/inputs/context.md": "ctx",
    });
    const result = agents.runAgent("coordinator", "run-1", "dry-run", null, deps);
    expect(result.status).toBe("done");
    const writeCall = (Legacy.writeJsonFile as any as Mock).mock.calls.find((c: any[]) => normalize(c[0]).endsWith("plan.json"));
    expect(writeCall).toBeTruthy();
    const plan = writeCall ? writeCall[1] : null;
    expect(plan?.steps?.length).toBeGreaterThanOrEqual(2);
  });

  it("marks human_gate blocked when override missing", () => {
    const { deps } = makeDeps({
      "/workspace/runs/run-1/inputs/request.md": "req",
      "/workspace/runs/run-1/inputs/context.md": "ctx",
    });
    const decisionSpy = vi.spyOn(stepPersistence, "writeDecision");
    const result = agents.runAgent("human_gate" as any, "run-1", "dry-run", null, deps);
    expect(result.status).toBe("blocked");
    const decisionPayload = decisionSpy.mock.calls[0][2] ?? decisionSpy.mock.calls[0][1];
    expect(JSON.stringify(decisionPayload)).toContain("missing inputs");
  });

  it("routes technical-writer through runner output", () => {
    const { deps } = makeDeps({
      "/workspace/runs/run-1/inputs/request.md": "req",
      "/workspace/runs/run-1/inputs/context.md": "ctx",
    });
    const runner = vi.spyOn(Runners, "runTechnicalWriter").mockReturnValue({ status: "done", summary: "ok" } as any);
    const result = agents.runAgent("technical-writer" as any, "run-1", "live", null, deps);
    expect(result.status).toBe("done");
    expect(runner).toHaveBeenCalled();
  });

  it("planner target file parse failure leaves defaults", () => {
    const { deps } = makeDeps({
      "/workspace/runs/run-1/planner_llm_target.json": "not-json",
      "/workspace/runs/run-1/inputs/request.md": "req",
      "/workspace/runs/run-1/inputs/context.md": "ctx",
    });
    const result = agents.runAgent("planner", "run-1", "dry-run", null, deps);
    expect(result.provider).toBeUndefined();
  });

  it("builds rationale when signals empty", () => {
    vi.spyOn(Legacy, "classifyFlow").mockReturnValue({
      signals: [],
      confidence: 1,
      pack: { flow_type: "type", steps: [] },
    } as any);
    const { deps } = makeDeps({
      "/workspace/runs/run-1/inputs/request.md": "req",
      "/workspace/runs/run-1/inputs/context.md": "ctx",
    });
    const result = agents.runAgent("coordinator", "run-1", "dry-run", null, deps);
    expect(result.summary?.toLowerCase()).toContain("run");
  });
});

describe("buildDecision branches", () => {
  it.each([
    { missing: ["a"], gate: { gate_status: "pass", hard_failed_ids: [], soft_failed_ids: [], notes: [] }, strictness: "soft", action: "request_clarification", reason: /missing inputs/ },
    { missing: [], gate: { gate_status: "hard_fail", hard_failed_ids: ["h1"], soft_failed_ids: [], notes: [] }, strictness: "soft", action: "halt", reason: /hard checks/ },
    { missing: [], gate: { gate_status: "soft_fail", hard_failed_ids: [], soft_failed_ids: ["s"], notes: [] }, strictness: "hard", action: "require_human", reason: /soft failures/ },
    { missing: [], gate: { gate_status: "soft_fail", hard_failed_ids: [], soft_failed_ids: ["s"], notes: [] }, strictness: "soft", action: "continue", reason: /soft failures tolerated/ },
  ])("buildDecision path %#", ({ missing, gate, strictness, action, reason }) => {
    const promptSpy = vi.spyOn(Legacy, "writeFileAtomic").mockImplementation(() => { });
    const decision = agents.buildDecision({
      runId: "run-1",
      stepId: "step-1",
      finishedAt: new Date("2020-01-01T00:00:00Z"),
      strictness: strictness as any,
      gateOutcome: gate as any,
      missingInputs: missing,
    });
    expect(decision.decision.action).toBe(action);
    expect(decision.decision.reason).toMatch(reason);
    if (action === "require_human" || action === "request_clarification") {
      expect(promptSpy).toHaveBeenCalled();
    }
    promptSpy.mockRestore();
  });
});
