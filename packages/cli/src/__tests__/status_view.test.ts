import fs from "fs";
import os from "os";
import path from "path";
import { describe, expect, it } from "vitest";
import { buildStatusView } from "../status_view";
import { renderStatusView } from "../status_render";

function writeJson(filePath: string, data: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function scaffoldRun(base: string, runId: string) {
  const runDir = path.join(base, "runs", runId);
  fs.mkdirSync(runDir, { recursive: true });
  return runDir;
}

describe("status view", () => {
  it("renders finished_success", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "status-success-"));
    const runId = "success-run";
    const runDir = scaffoldRun(tmp, runId);
    writeJson(path.join(runDir, "run.json"), {
      id: runId,
      flow: "demo",
      status: "done",
      started_at_utc: "2026-01-01T00:00:00Z",
      finished_at_utc: "2026-01-01T00:10:00Z",
      exit_code: 0,
      error: null,
    });
    writeJson(path.join(runDir, "steps", "index.json"), {
      run_id: runId,
      steps: [
        { step_index: 0, step_id: "planner", agent_name: "planner", status: "done", decision_action: "continue" },
      ],
    });
    writeJson(path.join(runDir, "steps", "planner", "decision_after_step.json"), { decision: { action: "continue" } });
    writeJson(path.join(runDir, "steps", "planner", "effective_decision.json"), { decision: { action: "continue" } });
    writeJson(path.join(runDir, "steps", "planner", "step_result.json"), { status: "done" });

    const view = buildStatusView(runDir);
    expect(view?.overall).toBe("finished_success");
    expect(view?.artifacts_valid).toBe(true);
    const rendered = renderStatusView(view!, null);
    expect(rendered).toContain("Overall: FINISHED_SUCCESS");
    expect(rendered).toContain("Artifacts: VALID");
    expect(rendered).toContain("Blocking: UNBLOCKED");
  });

  it("renders finished_failure and blocked state", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "status-failure-"));
    const runId = "failed-run";
    const runDir = scaffoldRun(tmp, runId);
    writeJson(path.join(runDir, "run.json"), {
      id: runId,
      flow: "demo",
      status: "failed",
      started_at_utc: "2026-01-01T00:00:00Z",
      finished_at_utc: "2026-01-01T00:05:00Z",
      exit_code: 1,
      error: "boom",
    });
    writeJson(path.join(runDir, "steps", "index.json"), {
      run_id: runId,
      steps: [
        { step_index: 0, step_id: "planner", agent_name: "planner", status: "failed", decision_action: "continue" },
      ],
    });
    writeJson(path.join(runDir, "steps", "planner", "decision_after_step.json"), { decision: { action: "continue" } });
    writeJson(path.join(runDir, "steps", "planner", "effective_decision.json"), { decision: { action: "continue" } });
    writeJson(path.join(runDir, "steps", "planner", "step_result.json"), { status: "failed" });

    const view = buildStatusView(runDir);
    expect(view?.overall).toBe("finished_failure");
    expect(view?.artifacts_valid).toBe(true);
    const rendered = renderStatusView(view!, null);
    expect(rendered).toContain("Overall: FINISHED_FAILURE");
    expect(rendered).toContain("Blocking: BLOCKED");
  });

  it("renders invalid when run.json is missing", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "status-invalid-"));
    const runId = "invalid-run";
    const runDir = scaffoldRun(tmp, runId);
    const view = buildStatusView(runDir);
    expect(view?.overall).toBe("invalid");
    expect(view?.artifacts_valid).toBe(false);
    const rendered = renderStatusView(view!, null);
    expect(rendered).toContain("Overall: INVALID");
    expect(rendered).toContain("Artifacts: INVALID");
    expect(rendered).toContain("Errors:");
  });
});
