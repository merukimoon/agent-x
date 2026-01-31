import fs from "fs";
import path from "path";
import process from "process";
import { fail } from "./errors.js";
import { RunId, ExecutionMode } from "./types.js";

/**
 * Create a lock file for flow execution.
 * @param {string} runDir
 * @param {RunId} runId
 * @param {ExecutionMode} mode
 * @returns {string} lockPath
 */
export function createFlowLock(runDir: string, runId: RunId, mode: ExecutionMode): string {
    const lockPath = path.join(runDir, ".lock");
    if (fs.existsSync(lockPath)) {
        const existing = fs.readFileSync(lockPath, "utf8");
        fail(
            `Lock exists at ${lockPath}. Another flow may be running. If stale, remove the lock and retry. Contents:\n${existing}`
        );
    }
    const startedAt = new Date().toISOString();
    const content = [
        `pid=${process.pid}`,
        `started_at_utc=${startedAt}`,
        `command=flow run=${runId} mode=${mode}`,
        "",
    ].join("\n");
    try {
        fs.writeFileSync(lockPath, content, { encoding: "utf8", flag: "wx" });
    } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        fail(`Unable to create lock at ${lockPath}. ${reason}`);
    }
    return lockPath;
}

/**
 * Remove lock file if present.
 * @param {string} lockPath
 */
export function removeLock(lockPath: string) {
    try {
        if (fs.existsSync(lockPath)) {
            fs.unlinkSync(lockPath);
        }
    } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        console.error(`WARN: Unable to remove lock ${lockPath}: ${reason}`);
    }
}
