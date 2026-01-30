// @ts-check

import { spawnSync } from 'child_process';
import fs, { mkdtempSync } from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';
import { applyMutation, copyDir, normalizeOutput, runCli } from './_utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const fixtureDir = path.join(__dirname, 'fixtures', 'minimal-project');
const goldenDir = path.join(__dirname, 'golden');
const manifestPath = path.join(goldenDir, 'manifest.json');

/** @type {null | Array<any>} */
let manifest = null;

function ensureManifest() {
  if (fs.existsSync(manifestPath)) {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    return;
  }
  const auto = process.env.AGENTIC_AUTOGEN_GOLDENS === '1';
  if (auto) {
    const result = spawnSync(
      'node',
      [path.join(__dirname, 'generate-golden.ts')],
      {
        encoding: 'utf8',
        env: { ...process.env, TZ: 'UTC' },
      },
    );
    if (result.status !== 0) {
      console.error(
        'Failed to auto-generate goldens:',
        result.stderr || result.stdout,
      );
      return;
    }
    if (fs.existsSync(manifestPath)) {
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    }
  }
}

ensureManifest();

if (!manifest) {
  describe.skip('CLI golden snapshots', () => {
    it('goldens missing', () => {
      // skipped
    });
  });
} else {
  describe('CLI golden snapshots', () => {
    manifest?.forEach((entry) => {
      it(`CLI snapshot: ${entry.name}`, () => {
        const tmp = mkdtempSync(path.join(os.tmpdir(), 'agentic-test-'));
        copyDir(fixtureDir, tmp);
        const runDir = path.join(tmp, 'runs', 'test-run');
        if (entry.mutation) {
          applyMutation(runDir, entry.mutation);
        }

        const result = runCli({ cwd: tmp, args: entry.args });
        const stdout = normalizeOutput(result.stdout, { cwd: tmp });
        const stderr = normalizeOutput(result.stderr, { cwd: tmp });

        const expStdout = normalizeOutput(
          fs.readFileSync(
            path.join(goldenDir, `${entry.name}.stdout.txt`),
            'utf8',
          ),
          { cwd: tmp },
        );
        const expStderr = normalizeOutput(
          fs.readFileSync(
            path.join(goldenDir, `${entry.name}.stderr.txt`),
            'utf8',
          ),
          { cwd: tmp },
        );

        const expCode = Number(
          fs
            .readFileSync(
              path.join(goldenDir, `${entry.name}.code.txt`),
              'utf8',
            )
            .trim(),
        );

        expect(stdout).toBe(expStdout);
        expect(stderr).toBe(expStderr);
        expect(result.code).toBe(expCode);
      });
    });
  });
}
