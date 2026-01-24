import fs from "fs";
import os from "os";
import path from "path";
import { describe, expect, it } from "vitest";
import { spawnSync } from "child_process";

function runScript(args: string[], cwd: string) {
  const res = spawnSync(process.execPath, ["--import", "tsx", ...args], {
    cwd,
    env: process.env,
    stdio: "pipe",
    encoding: "utf8",
  });
  return res;
}

describe("orchestrator gated flow", () => {
  const repoRoot = process.cwd();
  const runsDir = path.join(repoRoot, "runs");

  it("pauses with exit code 2 then resumes after override", () => {
    const runId = `gated-test-${Date.now()}`;
    const validateArgs = ["scripts/orchestrator/run-gated-validate.ts", "--goal", "gated demo", "--context", "ctx", "--run", runId];
    const res = runScript(validateArgs, repoRoot);
    expect(res.status).toBe(2);
    const runDir = path.join(runsDir, runId);
    const gateNotes = path.join(runDir, "outputs", "human_gate", "notes.md");
    const gateResult = path.join(runDir, "outputs", "human_gate", "result.json");
    expect(fs.existsSync(gateNotes)).toBe(true);
    expect(fs.existsSync(gateResult)).toBe(true);

    const overridePath = path.join(runDir, "outputs", "human_gate", "override.json");
    const override = {
      schema_version: "step-override.v1",
      run_id: runId,
      step_id: "human_gate",
      actor: { type: "human", id: "tester" },
      override_action: "continue",
      routing_override: null,
      acknowledged_risks: [],
      reason: "test override",
    };
    fs.mkdirSync(path.dirname(overridePath), { recursive: true });
    fs.writeFileSync(overridePath, JSON.stringify(override, null, 2));

    const flowRes = spawnSync(process.execPath, ["--import", "tsx", "scripts/agentic.ts", "flow", "--run", runId], {
      cwd: repoRoot,
      env: process.env,
      stdio: "pipe",
      encoding: "utf8",
    });
    expect(flowRes.status).toBe(0);
    const runJsonPath = path.join(runDir, "run.json");
    const runJson = JSON.parse(fs.readFileSync(runJsonPath, "utf8"));
    expect(runJson.status).toBe("done");
    expect(runJson.exit_code).toBe(0);

    fs.rmSync(runDir, { recursive: true, force: true });
  });
});
