// @ts-check

import fs from "fs";
import os from "os";
import path from "path";
import { mkdtempSync } from "fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { copyDir, runCli, normalizeOutput, applyMutation } from "./_utils.mjs";

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const fixtureDir = path.join(__dirname, "fixtures", "minimal-project");
const goldenDir = path.join(__dirname, "golden");
const manifestPath = path.join(goldenDir, "manifest.json");

if (!fs.existsSync(manifestPath)) {
  throw new Error("Golden manifest not found. Run `npm run test:golden` first.");
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

manifest.forEach((entry) => {
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
