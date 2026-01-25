import fs from "fs";
import os from "os";
import path from "path";
import { describe, expect, it } from "vitest";
import { verifyRun } from "../../packages/cli/src/cli.ts";

function writeJson(filePath: string, data: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

describe("verifyRun", () => {
  it("passes for a minimal valid run", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "verify-run-pass-"));
    const runId = "demo";
    const runDir = path.join(tmp, "runs", runId);
    fs.mkdirSync(path.join(runDir, "inputs"), { recursive: true });
    fs.writeFileSync(path.join(runDir, "inputs", "request.md"), "req", "utf8");
    fs.writeFileSync(path.join(runDir, "inputs", "context.md"), "ctx", "utf8");

    const plan = {
      run_id: runId,
      created_at_utc: "2026-01-01T00:00:00Z",
      version: "0.1",
      flow_type: "demo",
      rationale: "",
      signals: [],
      confidence: "low",
      steps: [
        {
          id: "planner",
          agent: "planner",
          depends_on: [],
          inputs: { request: "inputs/request.md", context: "inputs/context.md", prior_outputs: [] },
          outputs: { result: "outputs/planner/result.json", notes: "outputs/planner/notes.md" },
          status: "done",
          attempt: 0,
          max_attempts: 1,
          last_error: null,
          allow_skip: true,
        },
      ],
    };
    writeJson(path.join(runDir, "plan.json"), plan);
    writeJson(path.join(runDir, "run.json"), {
      id: runId,
      flow: "demo",
      status: "done",
      started_at_utc: "2026-01-01T00:00:00Z",
      finished_at_utc: "2026-01-01T00:10:00Z",
      exit_code: 0,
      error: null,
    });
    fs.mkdirSync(path.join(runDir, "summary"), { recursive: true });
    fs.writeFileSync(path.join(runDir, "summary", "final.md"), "Run demo done", "utf8");
    fs.mkdirSync(path.join(runDir, "outputs", "planner"), { recursive: true });
    fs.writeFileSync(path.join(runDir, "outputs", "planner", "notes.md"), "notes", "utf8");
    writeJson(path.join(runDir, "outputs", "planner", "result.json"), { status: "done" });
    writeJson(path.join(runDir, "outputs", "planner", "status.json"), {
      status: "done",
      finished_at_utc: "2026-01-01T00:10:00Z",
    });
    fs.mkdirSync(path.join(runDir, "steps", "planner"), { recursive: true });
    writeJson(path.join(runDir, "steps", "planner", "decision_after_step.json"), {});
    writeJson(path.join(runDir, "steps", "planner", "effective_decision.json"), {});
    writeJson(path.join(runDir, "steps", "planner", "step_result.json"), {});
    writeJson(path.join(runDir, "steps", "index.json"), [{ id: "planner", status: "done" }]);

    const result = verifyRun(runDir);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("fails when required inputs are missing (R1)", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "verify-run-missing-inputs-"));
    const runId = "demo";
    const runDir = path.join(tmp, "runs", runId);
    fs.mkdirSync(runDir, { recursive: true });
    writeJson(path.join(runDir, "run.json"), {
      id: runId,
      flow: "demo",
      status: "done",
      started_at_utc: "2026-01-01T00:00:00Z",
      finished_at_utc: "2026-01-01T00:10:00Z",
      exit_code: 0,
      error: null,
    });
    writeJson(path.join(runDir, "plan.json"), { steps: [] });
    fs.mkdirSync(path.join(runDir, "summary"), { recursive: true });
    fs.writeFileSync(path.join(runDir, "summary", "final.md"), "Run demo done", "utf8");

    const result = verifyRun(runDir);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("inputs/request.md"))).toBe(true);
    expect(result.errors.some((e) => e.includes("inputs/context.md"))).toBe(true);
  });

  it("fails when run is marked done but summary is missing (R2)", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "verify-run-missing-summary-"));
    const runId = "demo";
    const runDir = path.join(tmp, "runs", runId);
    fs.mkdirSync(path.join(runDir, "inputs"), { recursive: true });
    fs.writeFileSync(path.join(runDir, "inputs", "request.md"), "req", "utf8");
    fs.writeFileSync(path.join(runDir, "inputs", "context.md"), "ctx", "utf8");
    writeJson(path.join(runDir, "run.json"), {
      id: runId,
      flow: "demo",
      status: "done",
      started_at_utc: "2026-01-01T00:00:00Z",
      finished_at_utc: "2026-01-01T00:10:00Z",
      exit_code: 0,
      error: null,
    });
    writeJson(path.join(runDir, "plan.json"), { steps: [] });

    const result = verifyRun(runDir);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("summary/final.md"))).toBe(true);
  });

  it("fails when finished run exit_code is invalid for status done (R3)", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "verify-run-exitcode-"));
    const runId = "demo";
    const runDir = path.join(tmp, "runs", runId);
    fs.mkdirSync(path.join(runDir, "inputs"), { recursive: true });
    fs.writeFileSync(path.join(runDir, "inputs", "request.md"), "req", "utf8");
    fs.writeFileSync(path.join(runDir, "inputs", "context.md"), "ctx", "utf8");
    writeJson(path.join(runDir, "run.json"), {
      id: runId,
      flow: "demo",
      status: "done",
      started_at_utc: "2026-01-01T00:00:00Z",
      finished_at_utc: "2026-01-01T00:10:00Z",
      exit_code: 1,
      error: null,
    });
    writeJson(path.join(runDir, "plan.json"), { steps: [] });
    fs.mkdirSync(path.join(runDir, "summary"), { recursive: true });
    fs.writeFileSync(path.join(runDir, "summary", "final.md"), "Run demo done", "utf8");

    const result = verifyRun(runDir);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("exit_code"))).toBe(true);
  });

  it("fails when step outputs or step artifacts are missing (R2/R4/R5)", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "verify-run-step-artifacts-"));
    const runId = "demo";
    const runDir = path.join(tmp, "runs", runId);
    fs.mkdirSync(path.join(runDir, "inputs"), { recursive: true });
    fs.writeFileSync(path.join(runDir, "inputs", "request.md"), "req", "utf8");
    fs.writeFileSync(path.join(runDir, "inputs", "context.md"), "ctx", "utf8");
    const plan = {
      run_id: runId,
      created_at_utc: "2026-01-01T00:00:00Z",
      version: "0.1",
      flow_type: "demo",
      rationale: "",
      signals: [],
      confidence: "low",
      steps: [
        {
          id: "planner",
          agent: "planner",
          depends_on: [],
          inputs: { request: "inputs/request.md", context: "inputs/context.md", prior_outputs: [] },
          outputs: { result: "outputs/planner/result.json", notes: "outputs/planner/notes.md" },
          status: "done",
          attempt: 0,
          max_attempts: 1,
          last_error: null,
          allow_skip: true,
        },
      ],
    };
    writeJson(path.join(runDir, "plan.json"), plan);
    writeJson(path.join(runDir, "run.json"), {
      id: runId,
      flow: "demo",
      status: "done",
      started_at_utc: "2026-01-01T00:00:00Z",
      finished_at_utc: "2026-01-01T00:10:00Z",
      exit_code: 0,
      error: null,
    });
    fs.mkdirSync(path.join(runDir, "summary"), { recursive: true });
    fs.writeFileSync(path.join(runDir, "summary", "final.md"), "Run demo done", "utf8");
    fs.mkdirSync(path.join(runDir, "outputs", "planner"), { recursive: true });
    fs.mkdirSync(path.join(runDir, "steps", "planner"), { recursive: true });

    const result = verifyRun(runDir);
    expect(result.ok).toBe(false);
    expect(
      result.errors.some((e) => e.includes("outputs/planner/result.json") || e.includes("outputs/planner/notes.md"))
    ).toBe(true);
    expect(result.errors.some((e) => e.includes("steps/planner"))).toBe(true);
  });
});
