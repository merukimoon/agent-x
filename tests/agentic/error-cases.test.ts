// @ts-check

import fs from "fs";
import os from "os";
import path from "path";
import { mkdtempSync } from "fs";
import { fileURLToPath } from "url";
import { test, expect } from "vitest";
import { copyDir, runCli } from "./_utils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const fixtureDir = path.join(REPO_ROOT, "tests", "agentic", "fixtures", "minimal-project");
const scriptsDir = path.join(REPO_ROOT, "scripts");

function setupWorkdir(prefix) {
  const tmp = mkdtempSync(path.join(os.tmpdir(), prefix));
  copyDir(fixtureDir, tmp);
  copyDir(scriptsDir, path.join(tmp, "scripts"));
  copyDir(path.join(REPO_ROOT, "packages"), path.join(tmp, "packages"));
  return { tmp, runDir: path.join(tmp, "runs", "test-run") };
}

test("validate fails on invalid plan schema", () => {
  const { tmp, runDir } = setupWorkdir("agentic-negative-");
  const planPath = path.join(runDir, "plan.json");
  const plan = JSON.parse(fs.readFileSync(planPath, "utf8"));
  delete plan.run_id; // make schema invalid
  fs.writeFileSync(planPath, JSON.stringify(plan, null, 2) + "\n", "utf8");

  const result = runCli({
    cwd: tmp,
    args: ["scripts/agentic.ts", "validate", "--run", "test-run"],
    useTsx: true,
  });

  expect(result.code).toBe(12); // schema violation exit code
});

test("flow refuses to run when lock file exists", () => {
  const { tmp, runDir } = setupWorkdir("agentic-lock-");
  const lockPath = path.join(runDir, ".lock");
  fs.writeFileSync(lockPath, "pid=1234\nstarted_at_utc=now\ncommand=flow\n", "utf8");

  const result = runCli({
    cwd: tmp,
    args: ["scripts/agentic.ts", "flow", "--run", "test-run", "--dry-run"],
    useTsx: true,
  });

  expect(result.code).toBeGreaterThan(0);
});
