
import { spawnSync } from "child_process";
import path from "path";
import fs from "fs";

const REPO_ROOT = path.resolve(__dirname, "../../");
const CLI_ENTRY = path.join(REPO_ROOT, "packages/cli/src/bin/agentic.ts");

export type RunCliResult = {
    stdout: string;
    stderr: string;
    exitCode: number;
};

export function runCli(args: string[], options: { cwd?: string; env?: NodeJS.ProcessEnv } = {}): RunCliResult {
    const spawnOpts = {
        cwd: options.cwd || REPO_ROOT,
        env: { ...process.env, ...options.env },
        encoding: "utf8" as const,
        stdio: "pipe" as const,
    };

    // Run via tsx against source for dev speed
    const cmdArgs = ["--import", "tsx", CLI_ENTRY, ...args];

    const result = spawnSync("node", cmdArgs, spawnOpts);

    return {
        stdout: result.stdout || "",
        stderr: result.stderr || "",
        exitCode: result.status ?? 1,
    };
}

export function createTestRunDir(baseDir: string, runId: string) {
    const runDir = path.join(baseDir, "runs", runId);
    fs.mkdirSync(runDir, { recursive: true });
    return runDir;
}
