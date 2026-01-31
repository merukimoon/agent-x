import fs from "fs";
import path from "path";
import process from "process";
import { fail } from "./errors.js";
import { BuildNotesParams } from "./types.js";

/**
 * Read the first N lines from a file.
 * @param {string} filePath
 * @param {number} lineCount
 * @returns {string[]}
 */
export function readFirstLines(filePath: string, lineCount: number): string[] {
    try {
        const contents = fs.readFileSync(filePath, "utf8");
        const lines = contents.split(/\r?\n/);
        return lines.slice(0, lineCount);
    } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        fail(`Unable to read file: ${filePath}. ${reason}`);
    }
}

/**
 * Read full file contents as UTF-8.
 * @param {string} filePath
 * @returns {string}
 */
export function readFileText(filePath: string): string {
    try {
        return fs.readFileSync(filePath, "utf8");
    } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        fail(`Unable to read file: ${filePath}. ${reason}`);
    }
}

/**
 * Validate that run directory and inputs exist.
 * @param {string} runDir
 */
export function ensureRunAndInputs(runDir: string) {
    if (!fs.existsSync(runDir) || !fs.statSync(runDir).isDirectory()) {
        fail(`Run directory not found: ${runDir}`);
    }

    const requestPath = path.join(runDir, "inputs", "request.md");
    const contextPath = path.join(runDir, "inputs", "context.md");

    [requestPath, contextPath].forEach((filePath) => {
        if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
            fail(`Input file not found: ${filePath}`);
        }
    });
}

/**
 * Format a labeled excerpt as Markdown.
 * @param {string} label
 * @param {string[]} lines
 * @returns {string}
 */
export function formatExcerpt(label: string, lines: string[]): string {
    const safeLines = lines.length > 0 ? lines : ["(file empty)"];
    const quoted = safeLines.map((line) => `> ${line}`);
    return [`## ${label} (first 20 lines)`, ...quoted, ""].join("\n");
}

/**
 * Build agent notes content.
 * @param {BuildNotesParams} params
 * @returns {string}
 */
export function buildNotes({
    agentName,
    runId,
    createdAtUtc,
    mode,
    requestPath,
    contextPath,
    requestExcerpt,
    contextExcerpt,
}: BuildNotesParams): string {
    const modeDescription =
        mode === "dry-run" ? "dry-run (no external actions performed)" : mode;
    const summaryLines = [
        `- Agent: ${agentName}`,
        `- Run: ${runId}`,
        `- Mode: ${modeDescription}`,
        `- Created at (UTC): ${createdAtUtc}`,
        `- Inputs: ${requestPath}, ${contextPath}`,
    ];

    return [
        `# Agent: ${agentName}`,
        "",
        "Summary:",
        ...summaryLines,
        "",
        formatExcerpt("request.md", requestExcerpt),
        formatExcerpt("context.md", contextExcerpt),
    ].join("\n");
}

/**
 * Write to disk using temp file + rename.
 * @param {string} filePath
 * @param {string | Buffer} data
 */
export function writeFileAtomic(filePath: string, data: string | Buffer) {
    const dir = path.dirname(filePath);
    fs.mkdirSync(dir, { recursive: true });
    const tempName = `${path.basename(filePath)}.tmp.${process.pid}.${Date.now()}`;
    const tempPath = path.join(dir, tempName);
    fs.writeFileSync(tempPath, data, { encoding: typeof data === "string" ? "utf8" : undefined });
    let fd = -1;
    try {
        fd = fs.openSync(tempPath, "r");
        try {
            fs.fsyncSync(fd);
        } catch (error) {
            const code = (error as { code?: string })?.code;
            if (code !== "EPERM" && code !== "EINVAL" && code !== "EACCES") {
                throw error;
            }
            // Best effort: ignore fsync portability errors on some platforms.
        }
    } finally {
        if (fd !== -1) {
            try {
                fs.closeSync(fd);
            } catch {
                // ignore close errors
            }
        }
    }
    fs.renameSync(tempPath, filePath);
}

/**
 * Write JSON with trailing newline via atomic write.
 * @param {string} filePath
 * @param {unknown} data
 */
export function writeJsonFile(filePath: string, data: unknown) {
    const serialized = `${JSON.stringify(data, null, 2)}\n`;
    writeFileAtomic(filePath, serialized);
}
