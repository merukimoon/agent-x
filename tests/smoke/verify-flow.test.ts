import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { describe, expect, it } from "vitest";
import { normalizeOutput, runCli } from "../agentic/_utils.js";
import { resolveRunRequest, spawnNpmSync } from "../../scripts/smoke/verify-flow.ts";
import { selectArtifactPath } from "../../packages/cli/src/cli.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..", "..");

describe("verify-flow run selection", () => {
  it("uses --run when provided", () => {
    const result = resolveRunRequest(["--run", "run-123"], { RUN: "env-run" });
    expect(result.runId).toBe("run-123");
    expect(result.shouldScaffold).toBe(false);
  });

  it("uses env RUN when args are missing", () => {
    const result = resolveRunRequest([], { RUN: "env-run" } as NodeJS.ProcessEnv);
    expect(result.runId).toBe("env-run");
    expect(result.shouldScaffold).toBe(false);
  });

  it("scaffolds when no run is provided", () => {
    const result = resolveRunRequest([], {} as NodeJS.ProcessEnv);
    expect(result.runId).toBe(null);
    expect(result.shouldScaffold).toBe(true);
  });
});

describe("status artifact selection", () => {
  it("references stderr when notes are missing", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "verify-flow-status-"));
    const runId = "status-artifacts-run";
    const runDir = path.join(tmp, "runs", runId);
    const plannerDir = path.join(runDir, "outputs", "planner");

    fs.mkdirSync(plannerDir, { recursive: true });
    fs.writeFileSync(
      path.join(runDir, "run.json"),
      JSON.stringify({ id: runId, status: "failed" }, null, 2),
      "utf8"
    );
    fs.writeFileSync(
      path.join(plannerDir, "status.json"),
      JSON.stringify({ status: "failed", finished_at: "2026-01-23T00:00:00.000Z" }, null, 2),
      "utf8"
    );
    fs.writeFileSync(path.join(plannerDir, "stderr.txt"), "planner failed\n", "utf8");

    const artifact = selectArtifactPath(plannerDir, "failed");
    expect(artifact).toBe("stderr.txt");
  });
});

describe("spawnNpmSync", () => {
  it("runs npm -v successfully", () => {
    const res = spawnNpmSync(["-v"], { cwd: REPO_ROOT, stdio: "pipe" });
    if (res.error) {
      const err = res.error as { code?: string };
      expect(err.code ?? "").not.toBe("EINVAL");
    } else {
      expect(res.status).toBe(0);
    }
  });
});
