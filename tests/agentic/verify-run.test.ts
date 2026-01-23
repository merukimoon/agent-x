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

    const result = verifyRun(runDir);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("fails when artifacts are missing", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "verify-run-fail-"));
    const runId = "demo";
    const runDir = path.join(tmp, "runs", runId);
    fs.mkdirSync(runDir, { recursive: true });
    writeJson(path.join(runDir, "run.json"), { id: runId, status: "done", flow: "demo", started_at_utc: "1" });
    writeJson(path.join(runDir, "plan.json"), {
      run_id: runId,
      created_at_utc: "",
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
    });
    fs.mkdirSync(path.join(runDir, "summary"), { recursive: true });
    fs.writeFileSync(path.join(runDir, "summary", "final.md"), "Run demo", "utf8");
    const result = verifyRun(runDir);
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some((e) => e.includes("MISSING_ARTIFACT") || e.includes("MISSING_DIR"))).toBe(true);
  });
});
