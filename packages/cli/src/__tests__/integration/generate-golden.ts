#!/usr/bin/env node
// @ts-check

import fs from "fs";
import os from "os";
import path from "path";
import { mkdtempSync } from "fs";
import { fileURLToPath } from "url";
import { copyDir, runCli, normalizeOutput, applyMutation } from "./_utils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Resolve from repo root so execution is stable regardless of cwd.
const REPO_ROOT = path.resolve(__dirname, "..", "..", "..", "..", "..");
const fixtureDir = path.join(__dirname, "fixtures", "minimal-project");
const goldenDir = path.join(__dirname, "golden");

/** @type {{ name: string; args: string[]; mutation?: { type: "setStatus"; stepId: string; status: string; attempt?: number } }[]} */
const commands = [
  { name: "help", args: ["packages/cli/src/bin/agentic.ts", "--help"] },
  { name: "validate", args: ["packages/cli/src/bin/agentic.ts", "validate", "--run", "test-run"] },
  { name: "status", args: ["packages/cli/src/bin/agentic.ts", "status", "--run", "test-run"] },
  { name: "agent-coordinator", args: ["packages/cli/src/bin/agentic.ts", "agent", "coordinator", "--run", "test-run", "--dry-run"] },
  { name: "flow", args: ["packages/cli/src/bin/agentic.ts", "flow", "--run", "test-run", "--dry-run"] },
  {
    name: "retry",
    args: ["packages/cli/src/bin/agentic.ts", "retry", "--run", "test-run", "--step", "step-2"],
    mutation: { type: "setStatus", stepId: "step-2", status: "failed", attempt: 0 },
  },
  { name: "skip", args: ["packages/cli/src/bin/agentic.ts", "skip", "--run", "test-run", "--step", "step-1"] },
];

function ensureDirs() {
  const rel = path.relative(REPO_ROOT, goldenDir);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(`Golden directory resolved outside repo root: ${goldenDir}`);
  }
  fs.mkdirSync(goldenDir, { recursive: true });
}

function writeGolden(name, stdout, stderr, code) {
  fs.writeFileSync(path.join(goldenDir, `${name}.stdout.txt`), stdout, "utf8");
  fs.writeFileSync(path.join(goldenDir, `${name}.stderr.txt`), stderr, "utf8");
  fs.writeFileSync(path.join(goldenDir, `${name}.code.txt`), String(code), "utf8");
}

function main() {
  ensureDirs();
  const manifest = [];
  commands.forEach((entry) => {
    const tmp = mkdtempSync(path.join(os.tmpdir(), "agentic-golden-"));
    copyDir(fixtureDir, tmp);
    const runDir = path.join(tmp, "runs", "test-run");
    applyMutation(runDir, entry.mutation);
    const result = runCli({ cwd: tmp, args: entry.args, useTsx: true });
    const stdout = normalizeOutput(result.stdout, { cwd: tmp });
    const stderr = normalizeOutput(result.stderr, { cwd: tmp });
    writeGolden(entry.name, stdout, stderr, result.code);
    manifest.push({
      name: entry.name,
      args: entry.args,
      mutation: entry.mutation ?? null,
    });
  });
  fs.writeFileSync(path.join(goldenDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");
  console.log("Golden snapshots updated.");
}

main();
