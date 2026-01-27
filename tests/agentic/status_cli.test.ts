import fs from "fs";
import path from "path";
import { describe, expect, it, vi } from "vitest";
import { handleStatusCommand } from "../../packages/cli/src/cli";

function writeJson(filePath: string, data: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

const repoRoot = process.cwd();

describe("status CLI", () => {
  it("renders finished_success for a complete run", () => {
    const cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(repoRoot);
    const runId = "ok-run";
    const runDir = path.join(repoRoot, "runs", runId);
    fs.mkdirSync(path.join(runDir, "steps", "planner"), { recursive: true });
    fs.mkdirSync(path.join(runDir, "inputs"), { recursive: true });
    fs.writeFileSync(path.join(runDir, "inputs", "request.md"), "req", "utf8");
    fs.writeFileSync(path.join(runDir, "inputs", "context.md"), "ctx", "utf8");
    fs.mkdirSync(path.join(runDir, "summary"), { recursive: true });
    fs.writeFileSync(path.join(runDir, "summary", "final.md"), "summary", "utf8");
    writeJson(path.join(runDir, "run.json"), {
      id: runId,
      flow: "demo",
      status: "done",
      started_at_utc: "2026-01-01T00:00:00Z",
      finished_at_utc: "2026-01-01T00:10:00Z",
      exit_code: 0,
      error: null,
    });
    writeJson(path.join(runDir, "plan.json"), {
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
    });
    writeJson(path.join(runDir, "steps", "index.json"), {
      run_id: runId,
      steps: [{ step_index: 0, step_id: "planner", agent_name: "planner", status: "done", decision_action: "continue" }],
    });
    writeJson(path.join(runDir, "steps", "planner", "decision_after_step.json"), { decision: { action: "continue" } });
    writeJson(path.join(runDir, "steps", "planner", "effective_decision.json"), { decision: { action: "continue" } });
    writeJson(path.join(runDir, "steps", "planner", "step_result.json"), { status: "done" });
    fs.mkdirSync(path.join(runDir, "outputs", "planner"), { recursive: true });
    fs.writeFileSync(path.join(runDir, "outputs", "planner", "notes.md"), "notes", "utf8");
    writeJson(path.join(runDir, "outputs", "planner", "result.json"), { status: "done" });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const logs: string[] = [];
    logSpy.mockImplementation((msg?: unknown) => {
      logs.push(String(msg ?? ""));
    });

    try {
      handleStatusCommand(["--run", runId]);
    } finally {
      cwdSpy.mockRestore();
      logSpy.mockRestore();
      try { fs.rmSync(runDir, { recursive: true, force: true }); } catch {}
    }

    const output = logs.join("\n");
    expect(output).toContain("Overall: FINISHED_SUCCESS");
    expect(output).toContain("Artifacts: VALID");
  });

  it("throws when run directory is missing", () => {
    const cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(repoRoot);
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(() => handleStatusCommand(["--run", "missing-run"])).toThrowError();
    } finally {
      cwdSpy.mockRestore();
      errSpy.mockRestore();
    }
  });
});
