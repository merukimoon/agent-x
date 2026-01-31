import fs from "fs";
import path from "path";
import { Core } from "./imports.js";
import type { ExecutionMode } from "../../core/src/index.js";

const { readFirstLines, writeFileAtomic, writeJsonFile } = Core;

export interface RunnerParams {
    runId: string;
    outputsDir: string;
    requestPath: string;
    contextPath: string;
    mode: ExecutionMode;
}

export interface RunnerResult {
    status: "done" | "failed" | "blocked";
    summary: string;
}

export function runTechnicalWriter(params: RunnerParams): RunnerResult {
    const { runId, outputsDir, requestPath, contextPath, mode } = params;
    fs.mkdirSync(outputsDir, { recursive: true });
    const now = new Date().toISOString();
    const requestLines = readFirstLines(requestPath, 20);
    const contextLines = contextPath ? readFirstLines(contextPath, 20) : [];

    const notes = [
        "# Technical Writer",
        "",
        `Run: ${runId}`,
        `Mode: ${mode}`,
        `Created at (UTC): ${now}`,
        "",
        "Request excerpt:",
        ...requestLines.map((l: string) => `> ${l}`),
        "",
        "Context excerpt:",
        ...contextLines.map((l: string) => `> ${l}`),
        "",
        "Summary:",
        "- Documentation guidance prepared for downstream editing.",
    ].join("\n");
    writeFileAtomic(path.join(outputsDir, "notes.md"), notes);

    const result = {
        agent: "technical-writer",
        run_id: runId,
        status: "done",
        created_at_utc: now,
        summary: "Documentation review guidance prepared",
        mode,
        artifacts: {
            notes: "outputs/technical-writer/notes.md",
            status: "outputs/technical-writer/status.json",
            result: "outputs/technical-writer/result.json",
        },
    };
    writeJsonFile(path.join(outputsDir, "result.json"), result);
    writeJsonFile(path.join(outputsDir, "status.json"), {
        agent: "technical-writer",
        run_id: runId,
        status: "done",
        created_at_utc: now,
        finished_at_utc: now,
        mode,
    });

    return { status: "done", summary: result.summary };
}
