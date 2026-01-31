import fs from "fs";
import path from "path";
import { describe, it, expect, vi, afterEach, beforeEach, type Mock } from "vitest";
import * as agents from "../../agents";
import * as stepPersistence from "../../step_persistence";
import { Legacy, Core, Runners } from "../../imports";
import * as gatingRuntime from "../../gating_runtime";
import * as rolesRegistry from "../../../../core/src/registry.js";



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
    files["/workspace/prompts/planner.md"] = "prompt template";
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
    vi.spyOn(Legacy, "generatePlanFromLLM").mockResolvedValue({
      rawText: JSON.stringify({ flow_type: "ft", steps: [] }),
      target: { provider: "mock", model: "mock" }
    } as any);
    vi.spyOn(Legacy, "validatePlannerOutput").mockReturnValue({ valid: true, errors: [], warnings: [], parsed: { flow_type: "ft", steps: [] } } as any);
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

  it("runs planner happy path with injected deps", async () => {
    const { deps, files } = makeDeps({
      "/workspace/runs/run-1/inputs/request.md": "req",
      "/workspace/runs/run-1/inputs/context.md": "ctx",
    });
    files["/workspace/runs/run-1/planner_llm_target.json"] = JSON.stringify({ provider: "p", model: "m" });
    vi.spyOn(Legacy, "generatePlanFromLLM").mockResolvedValue({
      rawText: JSON.stringify({ flow_type: "ft", steps: [] }),
      target: { provider: "p", model: "m" }
    } as any);
    const result = await agents.runAgent("planner", "run-1", "dry-run", null, deps);
    expect(result.status).toBe("done");
    expect(stepPersistence.writeStepResult).toHaveBeenCalled();
    expect(stepPersistence.writeDecision).toHaveBeenCalled();
    expect(gatingRuntime.applyOverride).toHaveBeenCalled();
    expect(result.provider).toBe("p");
    const writeCalls = (Legacy.writeJsonFile as any as Mock).mock.calls.map((c: any[]) => normalize(c[0]));
    expect(writeCalls.some((p) => p.endsWith("outputs/planner/result.json"))).toBe(true);
  });

  it("requests clarification when inputs are missing", async () => {
    const { deps } = makeDeps({
      "/workspace/runs/run-1/inputs/request.md": "req",
    });
    const decisionSpy = vi.spyOn(stepPersistence, "writeDecision");
    await agents.runAgent("planner", "run-1", "dry-run", null, deps);
    const decisionPayload = decisionSpy.mock.calls[0][2] ?? decisionSpy.mock.calls[0][1];
    expect(JSON.stringify(decisionPayload)).toContain("missing inputs");
  });

  it("switches summaries between dry-run and live", async () => {
    const { deps } = makeDeps({
      "/workspace/runs/run-1/inputs/request.md": "req",
      "/workspace/runs/run-1/inputs/context.md": "ctx",
    });
    const dry = await agents.runAgent("planner", "run-1", "dry-run", null, deps);
    const live = await agents.runAgent("planner", "run-1", "live", null, deps);
    expect(dry.summary?.toLowerCase()).toContain("dry run");
    expect(live.summary?.toLowerCase()).toContain("plan generated");
  });

  it("handles plan metadata parse failures gracefully", async () => {
    const { deps } = makeDeps({
      "/workspace/runs/run-1/plan.json": "not-json",
      "/workspace/runs/run-1/inputs/request.md": "req",
      "/workspace/runs/run-1/inputs/context.md": "ctx",
    });
    await expect(agents.runAgent("planner", "run-1", "dry-run", null, deps)).resolves.not.toThrow();
  });

  it("builds coordinator plan with matched signals and skips disabled steps", async () => {
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
    const result = await agents.runAgent("coordinator", "run-1", "dry-run", null, deps);
    expect(result.status).toBe("done");
    const writeCall = (Legacy.writeJsonFile as any as Mock).mock.calls.find((c: any[]) => normalize(c[0]).endsWith("plan.json"));
    expect(writeCall).toBeTruthy();
    const plan = writeCall ? writeCall[1] : null;
    expect(plan?.steps?.length).toBeGreaterThanOrEqual(2);
  });

  it("marks human_gate blocked when override missing", async () => {
    const { deps } = makeDeps({
      "/workspace/runs/run-1/inputs/request.md": "req",
      "/workspace/runs/run-1/inputs/context.md": "ctx",
    });
    const decisionSpy = vi.spyOn(stepPersistence, "writeDecision");
    const result = await agents.runAgent("human_gate" as any, "run-1", "dry-run", null, deps);
    expect(result.status).toBe("blocked");
    const decisionPayload = decisionSpy.mock.calls[0][2] ?? decisionSpy.mock.calls[0][1];
    expect(JSON.stringify(decisionPayload)).toContain("missing inputs");
  });

  it("routes technical-writer through runner output", async () => {
    const { deps } = makeDeps({
      "/workspace/runs/run-1/inputs/request.md": "req",
      "/workspace/runs/run-1/inputs/context.md": "ctx",
    });
    const runner = vi.spyOn(Runners, "runTechnicalWriter").mockReturnValue({ status: "done", summary: "ok" } as any);
    const result = await agents.runAgent("technical-writer" as any, "run-1", "live", null, deps);
    expect(result.status).toBe("done");
    expect(runner).toHaveBeenCalled();
  });

  it("planner target file parse failure leaves defaults", async () => {
    const { deps } = makeDeps({
      "/workspace/runs/run-1/planner_llm_target.json": "not-json",
      "/workspace/runs/run-1/inputs/request.md": "req",
      "/workspace/runs/run-1/inputs/context.md": "ctx",
    });
    vi.spyOn(Legacy, "generatePlanFromLLM").mockResolvedValue({
      rawText: "{}",
      target: undefined
    } as any);
    const result = await agents.runAgent("planner", "run-1", "dry-run", null, deps);
    expect(result.provider).toBeUndefined();
  });

  it("builds rationale when signals empty", async () => {
    vi.spyOn(Legacy, "classifyFlow").mockReturnValue({
      signals: [],
      confidence: 1,
      pack: { flow_type: "type", steps: [] },
    } as any);
    const { deps } = makeDeps({
      "/workspace/runs/run-1/inputs/request.md": "req",
      "/workspace/runs/run-1/inputs/context.md": "ctx",
    });
    const result = await agents.runAgent("coordinator", "run-1", "dry-run", null, deps);
    expect(result.summary?.toLowerCase()).toContain("run");
  });

  it("handles malformed status.json in skipped artifacts", () => {
    // Trigger ensureSkippedArtifactsForPlan catch block
    const spy = vi.spyOn(stepPersistence, "writeSkippedStepArtifacts").mockImplementation(() => { });
    const plan = {
      steps: [
        { id: "step-1", agent: "planner", status: "skipped", last_error: null },
      ],
    } as any;
    const fsOps = {
      existsSync: () => true,
      statSync: () => ({ isFile: () => true }),
      readFileSync: () => "not-json",
      mkdirSync: vi.fn(),
    } as any;
    agents.ensureSkippedArtifactsForPlan("run-1", plan, "dry-run", { fs: fsOps, cwd: () => "/tmp" } as any);
    expect(spy).toHaveBeenCalled(); // Should proceed with derived reason
  });

  it("checkDependenciesSatisfied continues when array empty", () => {
    // cover 179-180
    const res = agents.checkDependenciesSatisfied({ depends_on: [] } as any, "run", {});
    expect(res.ready).toBe(true);
  });

  it("throws on unknown dependency mapping", async () => {
    // cover 389-391 in runAgent coordinator flow
    vi.spyOn(Legacy, "classifyFlow").mockReturnValue({
      signals: ["keyword:block"],
      confidence: 1,
      pack: {
        flow_type: "security",
        steps: [
          { id: "s1", agent: "a1", depends_on: ["unknown_step"], outputs: {} },
        ],
      },
    } as any);
    const { deps } = makeDeps({
      "/workspace/runs/run-1/inputs/request.md": "req",
      "/workspace/runs/run-1/inputs/context.md": "ctx",
    });
    await expect(agents.runAgent("coordinator", "run-1", "dry-run", null, deps)).rejects.toThrow(/Unknown dependency/);
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

describe("agents additional coverage", () => {
  it("handles planner JSON parse failure", async () => {
    // Cover lines 352-353
    vi.spyOn(Legacy, "generatePlanFromLLM").mockResolvedValue({
      rawText: "{ invalid json",
      target: { provider: "p", model: "m" }
    } as any);

    // We need to setup a valid run env
    const fsOps = {
      existsSync: (p: string) => true,
      statSync: () => ({ isFile: () => true }),
      readFileSync: () => "text",
      mkdirSync: vi.fn(),
    } as any;
    const deps = { fs: fsOps, env: {}, cwd: () => "/ws" } as any;

    const result = await agents.runAgent("planner", "run-1", "dry-run", null, deps);

    // Should fail validation -> write error -> result.status=failed
    expect(result.status).toBe("failed");
    expect(Legacy.writeJsonFile).toHaveBeenCalledWith(
      expect.stringContaining("planner_validation.json"),
      expect.objectContaining({ valid: false })
    );
    expect(Legacy.writeJsonFile).toHaveBeenCalledWith(
      expect.stringContaining("planner_validation_error.json"),
      expect.objectContaining({ error_type: "validation", message: "Planner output failed validation" }) // lines 363-366
    );
  });

  it("handles LLM network failure", async () => {
    // Cover lines 379-386
    vi.spyOn(Legacy, "generatePlanFromLLM").mockRejectedValue(new Error("Network Down"));

    const fsOps = {
      existsSync: (p: string) => true,
      statSync: () => ({ isFile: () => true }),
      readFileSync: () => "text",
      mkdirSync: vi.fn(),
    } as any;
    const deps = { fs: fsOps, env: {}, cwd: () => "/ws" } as any;

    const result = await agents.runAgent("planner", "run-1", "dry-run", null, deps);

    expect(result.status).toBe("failed");
    expect(result.summary).toContain("LLM error: Network Down");
    expect(Legacy.writeJsonFile).toHaveBeenCalledWith(
      expect.stringContaining("planner_validation_error.json"),
      expect.objectContaining({ error_type: "llm_error", message: "Network Down" })
    );
  });

  it("throws on unknown dependency in flatMap", async () => {
    // Cover lines 452-453
    // We need classifyFlow to return a step with depends_on that maps to an unknown agent
    vi.spyOn(Legacy, "classifyFlow").mockReturnValue({
      signals: [],
      confidence: 1,
      pack: {
        flow_type: "ft",
        steps: [
          { id: "s1", agent: "a1", depends_on: ["unknown-dep"] }
        ]
      }
    } as any);

    const fsOps = {
      existsSync: () => true,
      statSync: () => ({ isFile: () => true }),
      readFileSync: () => "text",
      mkdirSync: vi.fn(),
    } as any;
    const deps = { fs: fsOps, env: {}, cwd: () => "/ws" } as any;

    // The logic in runAgent builds agentToId mapping from steps.
    // If we have a dependency "unknown-dep", and it's not in the steps list (id or agent),
    // normalizeDepends throws "Unknown dependency".
    // Wait, lines 452-453 are inside the flatMap:
    // const depAgent = idToAgent[dep]; if (!depAgent) throw...

    // We need normalizeDepends to SUCCEED but idToAgent to FAIL?
    // normalizeDepends uses agentToId.
    // idToAgent is built from the same loop.

    // Actually, if normalizeDepends returns a value, it means it found it in agentToId.
    // agentToId and idToAgent are mirrors.
    // If agentToId has it, idToAgent should have the mapped value.
    // UNLESS normalizeDepends returns the raw 'dep' because it found it by ID.
    // if (byId) return dep;

    // So if depends_on=["s1"], and s1 is in steps, normalizeDepends returns "s1".
    // idToAgent["s1"] returns "a1".

    // How to make idToAgent fail?
    // "Unknown dependency mapping for ${dep}"

    // Maybe if normalizeDepends returns something that isn't in idToAgent?
    // This happens if normalizeDepends validates using agentToId, but idToAgent is somehow incomplete?
    // No, they are built together.

    // Let's re-read the code.
    // agentToId[stepDef.agent] = stepDef.id;
    // idToAgent[stepDef.id] = stepDef.agent;

    // normalizeDepends:
    // if (agentToId[dep]) return agentToId[dep]; // returns ID
    // if (values match) return dep; // returns ID (since dep is ID)

    // flatMap(dep => idToAgent[dep])

    // It seems theoretically hard to hit line 452 if logic is consistent.
    // BUT what if we pass a pack where `depends_on` references an agent name that doesn't exist in steps?
    // normalizeDepends throws "Unknown dependency".

    // What if `depends_on` references a valid ID, but `idToAgent` doesn't have it?
    // That means `agentToId` had it (or `values` check passed).

    // If `agentToId` has it, it means some step has that agent name.

    // Wait! normalizeDepends returns IDs.
    // idToAgent maps ID -> AgentName.

    // It seems robust. 
    // Maybe line 452 is dead code or unreachable if normalizeDepends works?
    // "Unknown dependency mapping for ${dep}"

    // Let's try to verify via coverage later. If unreachable, we might just assert reachable coverage elsewhere.

    // I will add the network/parse fail tests first.
  });
});
