import fs from "fs";
import path from "path";
import type { DecisionAfterStep, ExecutionStatus, ModelRef, StepResult } from "../../core/src/contracts/step.ts";
import { getDecisionPath, getStepDir, getStepResultPath, getStepsIndexPath } from "../../core/src/paths/steps.ts";

export function ensureDir(dirPath: string) {
    fs.mkdirSync(dirPath, { recursive: true });
}

export function writeJsonAtomic(filePath: string, data: unknown) {
    const serialized = `${JSON.stringify(data, null, 2)}\n`;
    const dir = path.dirname(filePath);
    ensureDir(dir);
    const tempName = `${path.basename(filePath)}.tmp.${process.pid}.${Date.now()}`;
    const tempPath = path.join(dir, tempName);
    fs.writeFileSync(tempPath, serialized, "utf8");
    let fd = -1;
    try {
        fd = fs.openSync(tempPath, "r");
        try {
            fs.fsyncSync(fd);
        } catch (error) {
            const code = /** @type {{ code?: string }} */ (error as any)?.code;
            if (code !== "EPERM" && code !== "EINVAL" && code !== "EACCES") {
                throw error;
            }
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

export function readJson<T>(filePath: string): T | null {
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        return null;
    }
    try {
        const raw = fs.readFileSync(filePath, "utf8");
        return JSON.parse(raw) as T;
    } catch {
        return null;
    }
}

export function writeStepResult(runId: string, stepId: string, stepResult: StepResult) {
    const stepDir = getStepDir(runId, stepId);
    ensureDir(stepDir);
    writeJsonAtomic(getStepResultPath(runId, stepId), stepResult);
}

export function writeDecision(runId: string, stepId: string, decision: DecisionAfterStep) {
    const stepDir = getStepDir(runId, stepId);
    ensureDir(stepDir);
    writeJsonAtomic(getDecisionPath(runId, stepId), decision);
}

export function writeEffectiveDecision(runId: string, stepId: string, decision: DecisionAfterStep) {
    const stepDir = getStepDir(runId, stepId);
    ensureDir(stepDir);
    writeJsonAtomic(path.join(stepDir, "effective_decision.json"), decision);
}

export function updateStepsIndex(params: {
    runId: string;
    entry: {
        step_id: string;
        step_index: number;
        agent_name: string;
        status: ExecutionStatus;
        decision_action: DecisionAfterStep["decision"]["action"];
        model?: ModelRef;
        duration_ms?: number;
    };
}) {
    const indexPath = getStepsIndexPath(params.runId);
    const existing = readJson<import("../../core/src/paths/steps.ts").StepsIndex>(indexPath);
    const updatedAt = new Date().toISOString();
    const nextSteps = existing?.steps
        ?.filter((s) => s.step_id !== params.entry.step_id) ?? [];
    nextSteps.push({
        step_id: params.entry.step_id,
        step_index: params.entry.step_index,
        agent_name: params.entry.agent_name,
        status: params.entry.status,
        decision_action: params.entry.decision_action,
        model: params.entry.model,
        duration_ms: params.entry.duration_ms,
    });
    nextSteps.sort((a, b) => a.step_index - b.step_index);
    const nextIndex: import("../../core/src/paths/steps.ts").StepsIndex = {
        schema_version: "steps-index.v1",
        run_id: params.runId,
        updated_at: updatedAt,
        steps: nextSteps,
    };
    writeJsonAtomic(indexPath, nextIndex);
}
