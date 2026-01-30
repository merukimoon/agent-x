import fs from "fs";
import os from "os";
import path from "path";
import { describe, expect, it } from "vitest";
import { detectGate } from "../../gate_check";
import { runFlow } from "../../cli";
import { CLIError } from "../../../../../scripts/agentic/errors";

function writeJson(filePath: string, data: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
}

function scaffoldGatedRun(root: string, runId: string) {
  const runDir = path.join(root, "runs", runId);
  fs.mkdirSync(path.join(runDir, "inputs"), { recursive: true });
  fs.writeFileSync(path.join(runDir, "inputs", "request.md"), "Goal", "utf8");
  fs.writeFileSync(path.join(runDir, "inputs", "context.md"), "Context", "utf8");

  const plan = {
    run_id: runId,
    created_at_utc: new Date().toISOString(),
    version: "0.1",
    flow_type: "test-flow",
    rationale: "test",
    signals: [],
    confidence: "low",
    steps: [
      {
        id: "step-0",
        agent: "planner",
        depends_on: [],
        inputs: { request: "inputs/request.md", context: "inputs/context.md", prior_outputs: [] },
        outputs: { result: "outputs/planner/result.json", notes: "outputs/planner/notes.md" },
        status: "pending",
        attempt: 0,
        max_attempts: 1,
        last_error: null,
        allow_skip: true,
      },
    ],
  };
  writeJson(path.join(runDir, "plan.json"), plan);
  writeJson(path.join(runDir, "steps", "index.json"), {
    schema_version: "steps-index.v1",
    run_id: runId,
    updated_at: new Date().toISOString(),
    steps: [
      {
        step_id: "step-0",
        step_index: 0,
        agent_name: "planner",
        status: "ok",
        decision_action: "require_human",
      },
    ],
  });
  return runDir;
}

describe("gate detection", () => {
  it("detects a gated step from index.json", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gate-det-"));
    const runDir = scaffoldGatedRun(tmp, "gated-run");
    const gate = detectGate(runDir);
    expect(gate).toBeTruthy();
    expect(gate?.step_id).toBe("step-0");
    expect(gate?.decision_action).toBe("require_human");
  });

  it("causes runFlow to exit with code 2 when gated", () => {
    const repoRuns = path.join(process.cwd(), "runs");
    const runId = `gated-run-${Date.now()}`;
    fs.rmSync(path.join(repoRuns, runId), { recursive: true, force: true });
    scaffoldGatedRun(process.cwd(), runId);
    expect(() => runFlow(runId, "live")).toThrowError(CLIError);
    try {
      runFlow(runId, "live");
    } catch (error) {
      if (error instanceof CLIError) {
        expect(error.exitCode).toBe(2);
      } else {
        throw error;
      }
    } finally {
      fs.rmSync(path.join(repoRuns, runId), { recursive: true, force: true });
    }
  });
});
