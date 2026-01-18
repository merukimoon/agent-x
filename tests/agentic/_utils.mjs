// @ts-check

import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";

/**
 * Spawn the CLI with given args.
 * @param {{ cwd: string; args: string[] }} options
 * @returns {{ stdout: string; stderr: string; code: number }}
 */
export function runCli({ cwd, args }) {
  const result = spawnSync("node", args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, TZ: "UTC" },
  });
  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    code: result.status ?? 0,
  };
}

/**
 * Normalize CLI output for snapshot comparisons.
 * @param {string} text
 * @param {{ cwd: string }} options
 * @returns {string}
 */
export function normalizeOutput(text, { cwd }) {
  let out = text;
  const escapedCwd = cwd.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
  out = out.replace(new RegExp(escapedCwd, "g"), "<CWD>");
  const tmpDir = os.tmpdir().replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
  out = out.replace(new RegExp(tmpDir, "g"), "<TMP>");
  out = out.replace(/\\+/g, "/");
  out = out.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z/g, "<ISO_DATE>");
  return out;
}

/**
 * Deep copy a directory.
 * @param {string} src
 * @param {string} dest
 */
export function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  fs.cpSync(src, dest, { recursive: true });
}

/**
 * Apply a plan mutation if provided.
 * @param {string} runDir
 * @param {{ type: "setStatus"; stepId: string; status: string; attempt?: number }} [mutation]
 */
export function applyMutation(runDir, mutation) {
  if (!mutation) return;
  const planPath = path.join(runDir, "plan.json");
  const plan = JSON.parse(fs.readFileSync(planPath, "utf8"));
  if (mutation.type === "setStatus") {
    const step = plan.steps.find((s) => s.id === mutation.stepId);
    if (step) {
      step.status = mutation.status;
      if (typeof mutation.attempt === "number") {
        step.attempt = mutation.attempt;
      }
    }
  }
  fs.writeFileSync(planPath, JSON.stringify(plan, null, 2) + "\n", "utf8");
}
