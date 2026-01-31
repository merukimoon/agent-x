// @ts-check

import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createRequire } from 'module';
import { pathToFileURL } from 'url';

const require = createRequire(import.meta.url);
const TSX_IMPORT = pathToFileURL(require.resolve('tsx')).href;

export interface RunCliDeps {
  env?: NodeJS.ProcessEnv;
  spawnSync?: typeof spawnSync;
}

export interface RunCliOptions {
  cwd: string;
  args: string[];
  useTsx?: boolean;
  deps?: RunCliDeps;
}

/**
 * Spawn the CLI with given args.
 */
export function runCli({ cwd, args, useTsx = false, deps }: RunCliOptions) {
  const finalArgs = useTsx ? ['--import', TSX_IMPORT, ...args] : args;
  const spawn = deps?.spawnSync ?? spawnSync;
  const env = {
    ...process.env,
    ...(deps?.env ?? {}),
    TZ: deps?.env?.TZ ?? 'UTC',
  };
  const result = spawn('node', finalArgs, {
    cwd,
    encoding: 'utf8',
    env,
  });
  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    code: result.status ?? 0,
  };
}

/**
 * Normalize CLI output for snapshot comparisons.
 * @param {string} text
 * @param {{ cwd: string }} options
 * @returns {string}
 */
function escapeRegex(value) {
  return value.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
}

function normalizeNewlines(text) {
  let out = text;
  if (out.startsWith('\ufeff')) {
    out = out.slice(1);
  }
  return out.replace(/\r\n/g, '\n');
}

function normalizePaths(text, cwd) {
  let out = text;
  const escapedCwd = escapeRegex(cwd);
  out = out.replace(new RegExp(escapedCwd, 'g'), '<CWD>');
  const tmpDir = escapeRegex(os.tmpdir());
  out = out.replace(new RegExp(tmpDir, 'g'), '<TMP>');
  out = out.replace(/\\+/g, '/');
  return out;
}

function normalizeTimestamps(text) {
  return text.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z/g, '<ISO_DATE>');
}

function normalizeNodeVersion(text) {
  return text.replace(/Node\.js v\d+\.\d+\.\d+/g, 'Node.js vX.Y.Z');
}

function normalizeNodeStack(text) {
  let out = text;
  out = out.replace(/node:internal[^\n]*\n\s*throw err;\n\s*\^\n\n/gs, '<NODE_INTERNAL_HEADER>\n');
  out = out.replace(/node:internal[^\s)]+/g, (match) => match.replace(/:\d+/g, ':<LINE>'));
  out = out.replace(/\(node:internal[^)]+\)/g, (match) => match.replace(/:\d+/g, ':<LINE>'));
  out = out.replace(/^\s+at .*/gm, (line) =>
    line
      .replace(/node:internal[^\s)]+/g, (m) => m.replace(/:\d+/g, ':<LINE>'))
      .replace(/\bat (Function|Module)\./, 'at <FN>.'),
  );
  return out;
}

function normalizeWhitespace(text) {
  return text
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, ''))
    .join('\n');
}

export function normalizeOutput(text, { cwd }) {
  let out = typeof text === 'string' ? text : String(text ?? '');
  out = normalizeNewlines(out);
  out = normalizePaths(out, cwd);
  out = normalizeTimestamps(out);
  out = normalizeNodeVersion(out);
  out = normalizeNodeStack(out);
  out = normalizeWhitespace(out);
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
  const planPath = path.join(runDir, 'plan.json');
  const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
  if (mutation.type === 'setStatus') {
    const step = plan.steps.find((s) => s.id === mutation.stepId);
    if (step) {
      step.status = mutation.status;
      if (typeof mutation.attempt === 'number') {
        step.attempt = mutation.attempt;
      }
    }
  }
  fs.writeFileSync(planPath, JSON.stringify(plan, null, 2) + '\n', 'utf8');
}
