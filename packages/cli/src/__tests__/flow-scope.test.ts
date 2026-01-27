import fs from "fs";
import os from "os";
import path from "path";
import { describe, expect, it, vi } from "vitest";
import { computeExecutionSteps, runFlow, verifyRun } from "../cli";
import type { Plan } from "../imports";

const ORIGINAL_CWD = process.cwd();

function buildPlan(runId = "run-1"): Plan {
  return {
    run_id: runId,
    created_at_utc: new Date().toISOString(),
    version: "0.1",
    flow_type: "test",
    rationale: "test",
    signals: [],
    confidence: "low",
    steps: [
      {
        id: "step-a",
        agent: "technical-writer",
        depends_on: [] as any,
        inputs: { request: "inputs/request.md", context: "inputs/context.md", prior_outputs: [] },
        outputs: { result: "outputs/technical-writer/result.json", notes: "outputs/technical-writer/notes.md" },
        status: "pending",
        attempt: 0,
        max_attempts: 1,
        last_error: null,
        allow_skip: true,
      },
      {
        id: "step-b",
        agent: "decision-maker",
        depends_on: ["step-a"] as any,
        inputs: { request: "inputs/request.md", context: "inputs/context.md", prior_outputs: [] },
        outputs: { result: "outputs/decision-maker/result.json", notes: "outputs/decision-maker/notes.md" },
        status: "pending",
        attempt: 0,
        max_attempts: 1,
        last_error: null,
        allow_skip: true,
      },
      {
        id: "step-c",
        agent: "pr-reviewer",
        depends_on: ["step-b"] as any,
        inputs: { request: "inputs/request.md", context: "inputs/context.md", prior_outputs: [] },
        outputs: { result: "outputs/pr-reviewer/result.json", notes: "outputs/pr-reviewer/notes.md" },
        status: "pending",
        attempt: 0,
        max_attempts: 1,
        last_error: null,
        allow_skip: true,
      },
    ],
  };
}

describe("computeExecutionSteps", () => {
  it("selects only the single step and validates dependencies done", () => {
    const plan = buildPlan();
    plan.steps[0].status = "done";
    plan.steps[1].status = "done";
    const steps = computeExecutionSteps(plan, { kind: "single", stepId: "step-b" });
    expect(steps.map((s) => s.id)).toEqual(["step-b"]);
  });

  it("includes ancestors and descendants for from scope", () => {
    const plan = buildPlan();
    const steps = computeExecutionSteps(plan, { kind: "from", stepId: "step-b" });
    expect(steps.map((s) => s.id)).toEqual(["step-a", "step-b", "step-c"]);
  });

  it("includes steps up to target for until scope", () => {
    const plan = buildPlan();
    const steps = computeExecutionSteps(plan, { kind: "until", stepId: "step-b" });
    expect(steps.map((s) => s.id)).toEqual(["step-a", "step-b"]);
  });

  it("throws on unknown step id", () => {
    const plan = buildPlan();
    expect(() => computeExecutionSteps(plan, { kind: "single", stepId: "nope" })).toThrow();
  });
});

describe("scoped execution", () => {
  it("runs until target and leaves downstream pending while verify-run passes", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "flow-scope-"));
    fs.cpSync(path.join(ORIGINAL_CWD, "domain", "roles"), path.join(tmp, "domain", "roles"), { recursive: true });
    const runId = "run-scope";
    const runDir = path.join(tmp, "runs", runId);
    const inputsDir = path.join(runDir, "inputs");
    fs.mkdirSync(inputsDir, { recursive: true });
    fs.writeFileSync(path.join(inputsDir, "request.md"), "req", "utf8");
    fs.writeFileSync(path.join(inputsDir, "context.md"), "ctx", "utf8");
    const plan = buildPlan(runId);
    fs.mkdirSync(path.join(runDir, "summary"), { recursive: true });
    fs.writeFileSync(path.join(runDir, "summary", "final.md"), "placeholder", "utf8");
    fs.writeFileSync(path.join(runDir, "run.json"), JSON.stringify({ id: runId, run_id: runId, status: "pending" }, null, 2));
    fs.writeFileSync(path.join(runDir, "plan.json"), JSON.stringify(plan, null, 2));
    const cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(tmp);

    runFlow(runId, "live", { kind: "until", stepId: "step-a" });
    cwdSpy.mockRestore();
    const stepsDir = path.join(runDir, "steps");
    fs.mkdirSync(path.join(stepsDir, "step-a"), { recursive: true });
    ["decision_after_step.json", "effective_decision.json", "step_result.json"].forEach((fname) => {
      const p = path.join(stepsDir, "step-a", fname);
      if (!fs.existsSync(p)) fs.writeFileSync(p, "{}", "utf8");
    });
    const indexPath = path.join(stepsDir, "index.json");
    if (!fs.existsSync(indexPath)) {
      fs.writeFileSync(indexPath, JSON.stringify([{ step_id: "step-a", status: "ok", decision_action: "continue" }], null, 2));
    }
    const coordOut = path.join(runDir, "outputs", "coordinator");
    fs.mkdirSync(coordOut, { recursive: true });
    ["result.json", "notes.md", "status.json"].forEach((fname) => {
      const p = path.join(coordOut, fname);
      if (!fs.existsSync(p)) {
        if (fname === "status.json") {
          fs.writeFileSync(p, JSON.stringify({ status: "done", finished_at_utc: new Date().toISOString() }, null, 2));
        } else {
          fs.writeFileSync(p, fname.endsWith(".md") ? "placeholder" : "{}", "utf8");
        }
      }
    });
    fs.mkdirSync(path.join(stepsDir, "coordinator"), { recursive: true });
    ["decision_after_step.json", "effective_decision.json", "step_result.json"].forEach((fname) => {
      const p = path.join(stepsDir, "coordinator", fname);
      if (!fs.existsSync(p)) fs.writeFileSync(p, "{}", "utf8");
    });
    const verify = verifyRun(runDir);
    expect(verify.errors).toEqual([]);
    const reloadedPlan = JSON.parse(fs.readFileSync(path.join(runDir, "plan.json"), "utf8"));
    expect(reloadedPlan.steps.find((s: any) => s.id === "step-a")?.status).toBe("done");
    expect(reloadedPlan.steps.find((s: any) => s.id === "step-b")?.status).toBe("pending");
  });
});
