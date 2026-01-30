import fs from "fs";
import os from "os";
import path from "path";
import { describe, expect, it, vi, afterEach } from "vitest";
import * as agents from "../agents.ts";
import type { PlanStep } from "../imports.ts";
import type { GateOutcome } from "../../../core/src/policy/gating.ts";

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
