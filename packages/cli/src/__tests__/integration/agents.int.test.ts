import fs from "fs";
import os from "os";
import path from "path";
import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import * as agents from "../../agents.ts";
import { Legacy } from "../../imports.ts";
import type { PlanStep } from "../../imports.ts";
import type { GateOutcome } from "../../../../core/src/policy/gating.ts";
import * as stepPersistence from "../../step_persistence.ts";
import * as rolesRegistry from "../../../../core/src/registry.js";
import * as gatingRuntime from "../../gating_runtime.ts";

vi.mock("../../step_persistence.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../step_persistence.ts")>();
  return {
    ...actual,
    writeSkippedStepArtifacts: vi.fn(),
    writeStepResult: vi.fn(),
    writeDecision: vi.fn(),
    writeEffectiveDecision: vi.fn(),
    updateStepsIndex: vi.fn(),
  };
});

vi.mock("../../../../core/src/registry.js", () => ({
  requireExecutableRole: vi.fn().mockReturnValue({
    id: "mock-agent",
    runner: "llm",
    blocking: false,
    required_artifacts: []
  }),
}));

vi.mock("../../gating_runtime.ts", () => ({
  readOverride: vi.fn(),
  determineStrictness: vi.fn().mockReturnValue("soft"),
  evaluateStepGates: vi.fn().mockReturnValue({ gate_status: "pass", hard_failed_ids: [], soft_failed_ids: [], notes: [] }),
  loadGatingPolicy: vi.fn(),
  applyOverride: vi.fn().mockImplementation((args) => args.baseDecision),
}));

describe("normalizeStatusLocal", () => {
  it("normalizes to lower-case keywords", () => {
    expect(agents.normalizeStatusLocal("SKIPPED")).toBe("skipped");
    expect(agents.normalizeStatusLocal("Done")).toBe("done");
    expect(agents.normalizeStatusLocal("IN_PROGRESS")).toBe("running");
    expect(agents.normalizeStatusLocal("unknown")).toBe("pending");
  });
});

describe("buildSkipReason", () => {
  it("fills in fallback message and code", () => {
    const reason = agents.buildSkipReason("not_applicable", "   ");
    expect(reason.message).toBe("Skipped (not_applicable)");
    expect(reason.code).toBe("not_applicable");
  });

  it("coerces invalid codes to policy_disabled", () => {
    const reason = agents.buildSkipReason("bad-code" as any, "foo");
    expect(reason.code).toBe("policy_disabled");
  });
});

describe("deriveSkipReason", () => {
  it("prefers step.last_error and dry-run reason code", () => {
    const step = {
      id: "step-1",
      agent: "decision-maker",
      depends_on: [],
      inputs: { request: "", context: "", prior_outputs: [] },
      outputs: { result: "", notes: "" },
      status: "skipped",
      attempt: 0,
      max_attempts: 1,
      last_error: "bad",
      allow_skip: true,
    } as PlanStep;
    const reason = agents.deriveSkipReason({ step, mode: "dry-run" });
    expect(reason.code).toBe("dry_run");
    expect(reason.message).toContain("bad");
  });
});

describe("dependency helpers", () => {
  const basePlanStep = {
    id: "step-1",
    agent: "decision-maker",
    depends_on: ["coordinator"],
    inputs: { request: "", context: "", prior_outputs: [] },
    outputs: { result: "", notes: "" },
    status: "pending",
    attempt: 0,
    max_attempts: 1,
    last_error: null,
    allow_skip: true,
  } as PlanStep;

  function setupDependencyRun(status: "done" | "failed") {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agents-dep-"));
    const runDir = path.join(tmpDir, "runs", "run-dep");
    const depDir = path.join(runDir, "outputs", "coordinator");
    fs.mkdirSync(depDir, { recursive: true });
    fs.writeFileSync(
      path.join(depDir, "result.json"),
      JSON.stringify({ status, agent: "coordinator" })
    );
    return { tmpDir, runDir };
  }

  it("maps depends_on using id map", () => {
    const normalized = agents.normalizeDepends(["coordinator", "step-1"], {
      planner: "planner",
      coordinator: "coordinator",
      "decision-maker": "step-1",
    });
    expect(normalized).toEqual(["coordinator", "step-1"]);
  });

  it("throws for unknown dependency", () => {
    expect(() => agents.normalizeDepends(["unknown-dep"], { planner: "planner" }))
      .toThrow('Unknown dependency "unknown-dep"');
  });

  it("identifies satisfied dependencies", () => {
    const { tmpDir, runDir } = setupDependencyRun("done");
    try {
      const result = agents.checkDependenciesSatisfied(basePlanStep, runDir, {
        coordinator: "coordinator",
      });
      expect(result.ready).toBe(true);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("reports blocking when dependency fails", () => {
    const { tmpDir, runDir } = setupDependencyRun("failed");
    try {
      const result = agents.checkDependenciesSatisfied(basePlanStep, runDir, {
        coordinator: "coordinator",
      });
      expect(result.ready).toBe(false);
      expect(result.blocking).toContain("status is failed");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("throws when ensureDependencies sees blocking dependency", () => {
    const { tmpDir, runDir } = setupDependencyRun("failed");
    try {
      expect(() => agents.ensureDependencies(basePlanStep, runDir, {} as any)).toThrow(
        /Dependencies not satisfied/
      );
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe("buildDecision", () => {
  function prepareRunDir(runId: string, stepId: string) {
    const runDir = path.join(process.cwd(), "runs", runId);
    fs.mkdirSync(path.join(runDir, "steps", stepId), { recursive: true });
    return { runDir };
  }

  const baseGateOutcome: GateOutcome = {
    gate_status: "pass",
    hard_failed_ids: [],
    soft_failed_ids: [],
    notes: [],
  };
  const baseParams = {
    runId: "decision-run",
    stepId: "step-1",
    finishedAt: new Date(),
    gateOutcome: baseGateOutcome,
    strictness: "soft" as const,
    missingInputs: [] as string[],
  };

  it("requests clarification when inputs are missing", () => {
    const { runDir } = prepareRunDir(baseParams.runId, baseParams.stepId);
    try {
      const decision = agents.buildDecision({
        ...baseParams,
        gateOutcome: baseParams.gateOutcome,
        missingInputs: ["inputs/request.md"],
      });
      expect(decision.decision.action).toBe("request_clarification");
      expect(decision.requirements.required_inputs).toEqual(["inputs/request.md"]);
      expect(decision.requirements.human_prompt_ref).toContain("human_prompt.md");
      expect(fs.existsSync(path.join(runDir, "steps", baseParams.stepId, "human_prompt.md"))).toBe(true);
    } finally {
      fs.rmSync(runDir, { recursive: true, force: true });
    }
  });

  it("halts when hard checks fail", () => {
    const { runDir } = prepareRunDir(baseParams.runId, baseParams.stepId);
    try {
      const decision = agents.buildDecision({
        ...baseParams,
        gateOutcome: { gate_status: "hard_fail", hard_failed_ids: ["hc"], soft_failed_ids: [], notes: [] },
        missingInputs: [],
      });
      expect(decision.decision.action).toBe("halt");
      expect(decision.requirements.human_prompt_ref).toBeNull();
    } finally {
      fs.rmSync(runDir, { recursive: true, force: true });
    }
  });

  it("requests human input when soft fail under hard policy", () => {
    const { runDir } = prepareRunDir(baseParams.runId, baseParams.stepId);
    try {
      const decision = agents.buildDecision({
        ...baseParams,
        strictness: "hard",
        gateOutcome: { gate_status: "soft_fail", hard_failed_ids: [], soft_failed_ids: ["sc"], notes: [] },
        missingInputs: [],
      });
      expect(decision.decision.action).toBe("require_human");
      expect(decision.requirements.human_prompt_ref).toContain("human_prompt.md");
    } finally {
      fs.rmSync(runDir, { recursive: true, force: true });
    }
  });

  it("continues when soft fail under soft policy", () => {
    const { runDir } = prepareRunDir(baseParams.runId, baseParams.stepId);
    try {
      const decision = agents.buildDecision({
        ...baseParams,
        strictness: "soft",
        gateOutcome: { gate_status: "soft_fail", hard_failed_ids: [], soft_failed_ids: ["sc"], notes: [] },
        missingInputs: [],
      });
      expect(decision.decision.action).toBe("continue");
    } finally {
      fs.rmSync(runDir, { recursive: true, force: true });
    }
  });
});

describe("mapAgentStatusToExecutionStatus", () => {
  it("returns the expected execution status per agent status", () => {
    expect(agents.mapAgentStatusToExecutionStatus("failed")).toBe("failed");
    expect(agents.mapAgentStatusToExecutionStatus("in_progress")).toBe("blocked");
    expect(agents.mapAgentStatusToExecutionStatus("blocked")).toBe("blocked");
    expect(agents.mapAgentStatusToExecutionStatus("skipped")).toBe("skipped");
    expect(agents.mapAgentStatusToExecutionStatus("done")).toBe("ok");
  });
});

describe("resolveStepMeta", () => {
  const mockPlanPath = path.join("runs", "run-123", "plan.json");
  const mockRunDir = path.join("runs", "run-123");

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns defaults when plan.json is missing", () => {
    vi.spyOn(fs, "existsSync").mockReturnValue(false);

    const result = agents.resolveStepMeta(mockRunDir, "planner");
    expect(result.stepId).toBe("planner");
    expect(result.stepIndex).toBe(0);
    expect(result.pipelineId).toBeNull();
  });

  it("resolves metadata from valid plan.json", () => {
    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    vi.spyOn(fs, "statSync").mockReturnValue({ isFile: () => true } as any);
    vi.spyOn(fs, "readFileSync").mockReturnValue(JSON.stringify({
      flow_type: "demo-flow",
      steps: [
        { agent: "planner", id: "p1", inputs: { prior_outputs: ["out1"] } }
      ]
    }));

    const result = agents.resolveStepMeta(mockRunDir, "planner");
    expect(result.stepId).toBe("p1");
    expect(result.stepIndex).toBe(0);
    expect(result.priorOutputs).toEqual(["out1"]);
    expect(result.pipelineId).toBe("demo-flow");
  });

  it("handles plan with no matching agent", () => {
    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    vi.spyOn(fs, "statSync").mockReturnValue({ isFile: () => true } as any);
    vi.spyOn(fs, "readFileSync").mockReturnValue(JSON.stringify({
      steps: [{ agent: "other" }]
    }));

    const result = agents.resolveStepMeta(mockRunDir, "planner");
    expect(result.stepId).toBe("planner"); // default
    expect(result.stepIndex).toBe(0);
  });

  it("handles malformed plan.json", () => {
    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    vi.spyOn(fs, "statSync").mockReturnValue({ isFile: () => true } as any);
    vi.spyOn(fs, "readFileSync").mockReturnValue("{ bad json");

    const result = agents.resolveStepMeta(mockRunDir, "planner");
    expect(result.stepId).toBe("planner");
    expect(result.pipelineId).toBeNull();
  });
});

describe("detectMissingInputs", () => {
  const mockRunDir = "/runs/run-123";

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    delete process.env.FORCE_MISSING_INPUTS;
  });

  it("returns empty list when all inputs exist", () => {
    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    vi.spyOn(fs, "statSync").mockReturnValue({ isFile: () => true } as any);

    const inputs = {
      context_ref: "inputs/context.md",
      request_ref: "inputs/request.md",
      artifacts_in: ["out/prev.json"],
    } as any;

    const missing = agents.detectMissingInputs(mockRunDir, inputs);
    expect(missing).toHaveLength(0);
  });

  it("returns missing files", () => {
    vi.spyOn(fs, "existsSync").mockImplementation((p) => {
      return (p as string).includes("context.md"); // only context exists
    });
    vi.spyOn(fs, "statSync").mockReturnValue({ isFile: () => true } as any);

    const inputs = {
      context_ref: "inputs/context.md",
      request_ref: "inputs/missing.md",
      artifacts_in: [],
    } as any;

    const missing = agents.detectMissingInputs(mockRunDir, inputs);
    expect(missing).toContain("inputs/missing.md");
    expect(missing).not.toContain("inputs/context.md");
  });

  it("includes forced missing inputs from env var", () => {
    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    vi.spyOn(fs, "statSync").mockReturnValue({ isFile: () => true } as any);
    process.env.FORCE_MISSING_INPUTS = "forced/missing.md, other/missing.json";

    const inputs = {
      context_ref: "inputs/context.md",
      request_ref: "inputs/request.md",
      artifacts_in: [],
    } as any;

    const missing = agents.detectMissingInputs(mockRunDir, inputs);
    expect(missing).toContain("forced/missing.md");
    expect(missing).toContain("other/missing.json");
  });
});


describe("readDependencyStatus", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agents-status-"));
  const runDir = path.join(tmpDir, "runs", "test-run");

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns error when file missing", () => {
    vi.spyOn(fs, "existsSync").mockReturnValue(false);
    const status = agents.readDependencyStatus("planner", runDir);
    expect(status.ok).toBe(false);
    expect(status.message).toContain("Dependency result missing");
  });

  it("returns error on parse failure", () => {
    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    vi.spyOn(fs, "statSync").mockReturnValue({ isFile: () => true } as any);
    vi.spyOn(fs, "readFileSync").mockReturnValue("{ invalid json");

    const status = agents.readDependencyStatus("planner", runDir);
    expect(status.ok).toBe(false);
    expect(status.message).toContain("parse failed");
  });
});

describe("ensureSkippedArtifactsForPlan", () => {
  const mockRunId = "run-skipped";
  const mockPlan = {
    steps: [
      {
        id: "s1",
        agent: "skipper",
        status: "skipped",
        last_error: "Manually skipped",
      },
      {
        id: "s2",
        agent: "runner",
        status: "pending", // should be ignored
      }
    ]
  } as any;



  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("writes artifacts for skipped steps", () => {
    vi.spyOn(fs, "existsSync").mockReturnValue(false);

    agents.ensureSkippedArtifactsForPlan(mockRunId, mockPlan, "live");

    expect(stepPersistence.writeSkippedStepArtifacts).toHaveBeenCalled();
    const calls = vi.mocked(stepPersistence.writeSkippedStepArtifacts).mock.calls;
    // We expect one call for the skipped step
    const call = calls.find(c => c[0].agentName === "skipper");
    expect(call).toBeDefined();
    expect(call?.[0]?.reason?.message).toContain("Manually skipped");
  });

  it("preserves existing skip reason from status.json", () => {
    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    // Mock fs.readFileSync to return the status.json content
    vi.spyOn(fs, "readFileSync").mockReturnValue(JSON.stringify({
      reason: { code: "policy_disabled", message: "Policy said no" }
    }));
    // We also need to mock statSync if used by checks?
    // In agents.ts:62 `if (fs.existsSync(statusPath))` - check only.
    // But verify behavior.

    agents.ensureSkippedArtifactsForPlan(mockRunId, mockPlan, "live");

    expect(stepPersistence.writeSkippedStepArtifacts).toHaveBeenCalled();
    const calls = vi.mocked(stepPersistence.writeSkippedStepArtifacts).mock.calls;
    const call = calls.find(c => c[0].agentName === "skipper");
    expect(call?.[0]?.reason?.message).toContain("Policy said no");
  });

  it("handles corrupt status.json", () => {
    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    vi.spyOn(fs, "readFileSync").mockReturnValue("{ bad json");

    agents.ensureSkippedArtifactsForPlan(mockRunId, mockPlan, "live");

    expect(stepPersistence.writeSkippedStepArtifacts).toHaveBeenCalled();
    const calls = vi.mocked(stepPersistence.writeSkippedStepArtifacts).mock.calls;
    const call = calls.find(c => c[0].agentName === "skipper");
    // Fallback behavior (derived reason)
    expect(call?.[0]?.reason?.message).toContain("Manually skipped");
  });
});

describe("runAgent", () => {
  let tmpDir: string;
  let runDir: string;
  const runId = "test-run";

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-test-"));
    runDir = path.join(tmpDir, "runs", runId);
    fs.mkdirSync(runDir, { recursive: true });
    vi.spyOn(process, "cwd").mockReturnValue(tmpDir);
    // Ensure inputs dir exists as Legacy.ensureRunAndInputs might try to create it or read from it
    fs.mkdirSync(path.join(runDir, "inputs"), { recursive: true });
    fs.writeFileSync(path.join(runDir, "inputs", "request.md"), "req");
    fs.writeFileSync(path.join(runDir, "inputs", "context.md"), "ctx");

    // Reset default mocks
    vi.mocked(rolesRegistry.requireExecutableRole).mockReturnValue({
      id: "mock-agent",
      runner: "llm",
      blocking: false,
      required_artifacts: []
    });

    vi.mocked(gatingRuntime.evaluateStepGates).mockReturnValue({
      gate_status: "pass",
      hard_failed_ids: [],
      soft_failed_ids: [],
      notes: []
    });
    vi.mocked(gatingRuntime.determineStrictness).mockReturnValue("soft");
    vi.mocked(gatingRuntime.readOverride).mockReturnValue(null);
    vi.mocked(gatingRuntime.applyOverride).mockImplementation((args) => args.baseDecision);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("reads planner target info from file", async () => {
    const targetInfo = { model: "gpt-4-turbo", provider: "openai" };
    fs.writeFileSync(
      path.join(runDir, "planner_llm_target.json"),
      JSON.stringify(targetInfo)
    );

    const result = await agents.runAgent("planner", runId, "live");

    // Check result.model/provider
    expect(result.model).toBe("gpt-4-turbo");
    expect(result.provider).toBe("openai");
  });

  it("handles planner target info parse error", async () => {
    fs.writeFileSync(
      path.join(runDir, "planner_llm_target.json"),
      "{ bad json"
    );
    // Should not throw, just ignore
    const result = await agents.runAgent("planner", runId, "live");
    expect(result.model).toBeUndefined();
  });

  it("blocks human_gate when override missing", async () => {
    // Mock requireExecutableRole to return human_gate runner
    vi.mocked(rolesRegistry.requireExecutableRole).mockReturnValue({
      id: "human_gate",
      runner: "human_gate",
      blocking: true,
      required_artifacts: []
    });

    // Gating runtime mock returns null for override (default)

    const result = await agents.runAgent("human_gate", runId, "live");

    expect(result.status).toBe("blocked");
    expect(result.summary).toContain("Awaiting human override");

    // Check notes.md contains instructions
    const notesPath = path.join(runDir, "outputs", "human_gate", "notes.md");
    const notes = fs.readFileSync(notesPath, "utf8");
    expect(notes).toContain("Create: outputs/human_gate/override.json");

    // Check decision missing inputs
    // decision is written to steps/human_gate/decision.json
    const decisionPath = path.join(runDir, "steps", "human_gate", "decision.json");
    // Check decision missing inputs by verifying writeDecision call
    expect(stepPersistence.writeDecision).toHaveBeenCalled();
    const decisionCall = vi.mocked(stepPersistence.writeDecision).mock.calls.find(c => c[0] === runId && c[1] === "human_gate");
    expect(decisionCall).toBeDefined();
    const decisionArg = decisionCall?.[2];
    expect(decisionArg?.decision?.action).toBe("request_clarification");
    expect(decisionArg?.requirements?.required_inputs).toEqual(expect.arrayContaining([expect.stringContaining("override.json")]));
  });

  it("coordinator generates plan", async () => {
    // Mock requireExecutableRole for coordinator
    vi.mocked(rolesRegistry.requireExecutableRole).mockReturnValue({
      id: "coordinator",
      runner: "rule",
      blocking: false,
      required_artifacts: []
    });

    // Mock Legacy.classifyFlow
    vi.spyOn(Legacy, "classifyFlow").mockReturnValue({
      pack: {
        flow_type: "test-flow",
        keywords: [],
        steps: [
          { id: "step1", agent: "planner", depends_on: ["planner"] }
          // planner is mapped to "planner", coordinator to "coordinator"
        ]
      },
      signals: ["keyword:foo"],
      confidence: "high"
    });

    const result = await agents.runAgent("coordinator", runId, "live");

    expect(result.status).toBe("done");

    const planPath = path.join(runDir, "plan.json");
    expect(fs.existsSync(planPath)).toBe(true);
    const plan = JSON.parse(fs.readFileSync(planPath, "utf8"));
    expect(plan.flow_type).toBe("test-flow");
    expect(plan.steps).toHaveLength(3); // coordinator + planner (explicit) + step1 (planner)
  });

  it("skips step if enabled_if_keywords mismatch", async () => {
    vi.mocked(rolesRegistry.requireExecutableRole).mockReturnValue({
      id: "coordinator",
      runner: "rule",
      blocking: false,
      required_artifacts: []
    });
    vi.spyOn(Legacy, "classifyFlow").mockReturnValue({
      pack: {
        flow_type: "secure-flow",
        keywords: [],
        steps: [
          { id: "s1", agent: "ciso", depends_on: [], enabled_if_keywords: ["secret"] }
        ]
      },
      signals: ["keyword:public"],
      confidence: "high"
    });

    const result = await agents.runAgent("coordinator", runId, "live");
    const planPath = path.join(runDir, "plan.json");
    const plan = JSON.parse(fs.readFileSync(planPath, "utf8"));
    const cisoStep = plan.steps.find((s: any) => s.id === "s1");
    expect(cisoStep.status).toBe("skipped");
    expect(cisoStep.last_error).toContain("no security signals");
  });

  it("uses simple rationale if signals empty", async () => {
    vi.mocked(rolesRegistry.requireExecutableRole).mockReturnValue({
      id: "coordinator",
      runner: "rule",
      blocking: false,
      required_artifacts: []
    });
    vi.spyOn(Legacy, "classifyFlow").mockReturnValue({
      pack: {
        flow_type: "basic",
        keywords: [],
        steps: []
      },
      signals: [],
      confidence: "high"
    });

    await agents.runAgent("coordinator", runId, "live");
    const planPath = path.join(runDir, "plan.json");
    const plan = JSON.parse(fs.readFileSync(planPath, "utf8"));
    expect(plan.rationale).toBe("Selected basic.");
  });
});
