import fs from "fs";
import path from "path";
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  applyStatusTransitionWrapper,
  computeExecutionSteps,
  parseRunArgs,
  parseRunAndStepArgs,
  selectArtifactPath,
} from "../../cli";
import { isAllowedStatusTransition, applyStatusTransition } from "../../status";
import { Legacy } from "../../imports";

describe("CLI status helpers", () => {
  const basePlan = {
    steps: [
      { id: "step-1", agent: "planner", status: "done", depends_on: [] as string[] },
      { id: "step-2", agent: "technical-writer", status: "pending", depends_on: ["step-1"] },
      { id: "step-3", agent: "coordinator", status: "pending", depends_on: ["step-1"] },
    ],
  };

  it("returns the configured step for single scopes", () => {
    const result = computeExecutionSteps(basePlan as any, { kind: "single", stepId: "step-2" });
    expect(result.map((step) => step.id)).toEqual(["step-2"]);
  });

  it("includes ancestors and dependents for from scopes", () => {
    const result = computeExecutionSteps(basePlan as any, { kind: "from", stepId: "step-2" });
    expect(result.map((step) => step.id).sort()).toEqual(["step-1", "step-2"].sort());
  });

  it("returns prefix steps for until scopes", () => {
    const result = computeExecutionSteps(basePlan as any, { kind: "until", stepId: "step-2" });
    expect(result.map((step) => step.id)).toEqual(["step-1", "step-2"]);
  });

  it("applies a permitted transition and invokes the mutator", () => {
    const plan = {
      steps: [{ id: "step-1", agent: "planner", status: "pending", depends_on: [] }],
    };
    const mutator = vi.fn();
    applyStatusTransitionWrapper(plan as any, "step-1", "running", "/tmp/plan.json", mutator);
    expect(plan.steps[0].status).toBe("running");
    expect(mutator).toHaveBeenCalledWith(plan.steps[0]);
  });

  it.each([
    { from: "pending", to: "pending", allowed: true },
    { from: "pending", to: "running", allowed: true },
    { from: "pending", to: "done", allowed: false },
    { from: "unknown" as any, to: "pending", allowed: false },
  ])("isAllowedStatusTransition %#", ({ from, to, allowed }) => {
    expect(isAllowedStatusTransition(from, to)).toBe(allowed);
  });

  it("fails when step is missing", () => {
    const failSpy = vi.spyOn(Legacy, "fail").mockImplementation(() => {
      throw new Error("missing");
    });
    expect(() => applyStatusTransition({ steps: [] } as any, "nope", "running", "/tmp/plan.json", vi.fn())).toThrow(/Step nope not found/);
    failSpy.mockRestore();
  });

  it("fails on invalid transition without mutator", () => {
    const plan = { steps: [{ id: "step-1", status: "done" }] } as any;
    const failSpy = vi.spyOn(Legacy, "fail").mockImplementation(() => {
      throw new Error("invalid");
    });
    expect(() => applyStatusTransition(plan, "step-1", "running", "/tmp/plan.json", vi.fn())).toThrow(/Invalid status transition/);
    failSpy.mockRestore();
  });

  it("parses run arguments", () => {
    const parsed = parseRunArgs(["--run", "my-run", "--from", "step-2", "--dry-run", "--context", "README.md"]);
    expect(parsed.runId).toBe("my-run");
    expect(parsed.dryRun).toBe(true);
    expect(parsed.fromStepId).toBe("step-2");
    expect(parsed.contextPath).toBe("README.md");
  });

  it("parses run and step flags", () => {
    const parsed = parseRunAndStepArgs(["--run=run-1", "--step", "step-1", "--extra", "value"]);
    expect(parsed).toEqual({ runId: "run-1", stepId: "step-1", remainder: ["--extra", "value"] });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("selects the first matching artifact candidate", () => {
    const candidateDir = "/tmp/agent";
    const calls: string[] = [];
    vi.spyOn(fs, "existsSync").mockImplementation((filePath) => {
      calls.push(`exists:${filePath}`);
      return filePath.endsWith("stderr.txt") ? true : false;
    });
    vi.spyOn(fs, "statSync").mockImplementation(() => ({ isFile: () => true } as any));
    const artifact = selectArtifactPath(candidateDir, "running");
    expect(artifact).toBe("stderr.txt");
    expect(calls.some((call) => call.includes("stderr.txt"))).toBe(true);
  });

  it("returns null when no artifact exists", () => {
    vi.spyOn(fs, "existsSync").mockReturnValue(false);
    const artifact = selectArtifactPath("/tmp/none", "pending");
    expect(artifact).toBeNull();
  });
});
