import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";
import { describe, expect, it, beforeEach, afterEach } from "vitest";

function writeJson(filePath: string, data: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

describe("status CLI", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "status-cli-"));
  });

  afterEach(() => {
    try {
      fs.rmSync(tmp, { recursive: true, force: true });
    } catch {}
  });

  it("exits 0 and renders finished_success", () => {
    const runId = "ok-run";
    const runDir = path.join(tmp, "runs", runId);
    fs.mkdirSync(path.join(runDir, "steps", "planner"), { recursive: true });
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
      steps: [{ step_index: 0, step_id: "planner", agent_name: "planner", status: "done", decision_action: "continue" }],
    });
    writeJson(path.join(runDir, "steps", "planner", "decision_after_step.json"), { decision: { action: "continue" } });
    writeJson(path.join(runDir, "steps", "planner", "effective_decision.json"), { decision: { action: "continue" } });
    writeJson(path.join(runDir, "steps", "planner", "step_result.json"), { status: "done" });

    const res = spawnSync("node", ["--import", "tsx", path.join(process.cwd(), "packages/cli/src/cli.ts"), "status", "--run", runId], {
      cwd: tmp,
      encoding: "utf8",
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain("Overall: FINISHED_SUCCESS");
    expect(res.stdout).toContain("Artifacts: VALID");
  });

  it("exits non-zero when run directory is missing", () => {
    const res = spawnSync("node", ["--import", "tsx", path.join(process.cwd(), "packages/cli/src/cli.ts"), "status", "--run", "missing-run"], {
      cwd: tmp,
      encoding: "utf8",
    });
    expect(res.status).not.toBe(0);
    expect(res.stderr).toContain("Run directory not found");
  });
});
