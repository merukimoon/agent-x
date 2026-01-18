// @ts-check

import fs from "fs";
import os from "os";
import path from "path";
import { mkdtempSync } from "fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { copyDir, runCli, normalizeOutput, applyMutation } from "./_utils.mjs";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const fixtureDir = path.join(REPO_ROOT, "tests", "agentic", "fixtures", "minimal-project");
const goldenDir = path.join(REPO_ROOT, "tests", "agentic", "golden");
const manifestPath = path.join(goldenDir, "manifest.json");

/** @type {null | Array<any>} */
let manifest = null;

function ensureManifest() {
  if (fs.existsSync(manifestPath)) {
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    return;
  }
  const auto = process.env.AGENTIC_AUTOGEN_GOLDENS === "1";
  if (auto) {
    const result = spawnSync("node", [path.join(REPO_ROOT, "tests", "agentic", "generate-golden.mjs")], {
      encoding: "utf8",
      env: { ...process.env, TZ: "UTC" },
    });
    if (result.status !== 0) {
      console.error("Failed to auto-generate goldens:", result.stderr || result.stdout);
      return;
    }
    if (fs.existsSync(manifestPath)) {
      manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    }
    return;
  }
}

ensureManifest();

if (!manifest) {
  test("golden snapshots unavailable", (t) => {
    t.skip("Golden manifest not found. Run `npm run test:golden` (or set AGENTIC_AUTOGEN_GOLDENS=1).");
  });
}

manifest?.forEach((entry) => {
  test(`CLI snapshot: ${entry.name}`, () => {
    const tmp = mkdtempSync(path.join(os.tmpdir(), "agentic-test-"));
    copyDir(fixtureDir, tmp);
    const runDir = path.join(tmp, "runs", "test-run");
    if (entry.mutation) {
      applyMutation(runDir, entry.mutation);
    }

    const result = runCli({ cwd: tmp, args: entry.args });
    const stdout = normalizeOutput(result.stdout, { cwd: tmp });
    const stderr = normalizeOutput(result.stderr, { cwd: tmp });

    const expStdout = fs.readFileSync(path.join(goldenDir, `${entry.name}.stdout.txt`), "utf8");
    const expStderr = fs.readFileSync(path.join(goldenDir, `${entry.name}.stderr.txt`), "utf8");
    const expCode = Number(
      fs.readFileSync(path.join(goldenDir, `${entry.name}.code.txt`), "utf8").trim()
    );

    assert.equal(stdout, expStdout, "stdout mismatch");
    assert.equal(stderr, expStderr, "stderr mismatch");
    assert.equal(result.code, expCode, "exit code mismatch");
  });
});
