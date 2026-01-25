import fs from "fs";
import path from "path";
import type { DecisionAfterStep, ExecutionStatus, ModelRef, SkipReason, StepResult } from "../../contracts/src/index.ts";
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

export function writeSkippedStepArtifacts(params: {
    runId: string;
    stepId: string;
    stepIndex: number;
    agentName: string;
    reason: SkipReason;
    outputsDir: string;
    mode: string;
}) {
    const { runId, stepId, stepIndex, agentName, reason, outputsDir, mode } = params;
    const nowIso = new Date().toISOString();
    ensureDir(outputsDir);
    const summaryRef = path.join("outputs", agentName, "notes.md");
    const resultPath = path.join(outputsDir, "result.json");
    const notesPath = path.join(outputsDir, "notes.md");
    const statusPath = path.join(outputsDir, "status.json");

    writeJsonAtomic(resultPath, {
        agent: agentName,
        run_id: runId,
        status: "skipped",
        created_at_utc: nowIso,
        finished_at_utc: nowIso,
        summary: reason.message,
        mode,
        reason,
    });
    const notesBody = [`# ${agentName}`, "", `Status: skipped (${reason.code})`, `Reason: ${reason.message}`].join("\n");
    fs.writeFileSync(notesPath, `${notesBody}\n`, "utf8");
    writeJsonAtomic(statusPath, {
        agent: agentName,
        run_id: runId,
        status: "skipped",
        mode,
        finished_at_utc: nowIso,
        reason,
    });

    const stepResult: StepResult = {
        schema_version: "step-result.v1",
        run_id: runId,
        step_id: stepId,
        step_index: stepIndex,
        agent_name: agentName,
        model: {
            provider: "unknown",
            name: "unknown",
            mode,
            temperature: null,
        },
        timestamps: {
            started_at: nowIso,
            finished_at: nowIso,
            duration_ms: 0,
        },
        inputs: {
            context_ref: "inputs/context.md",
            request_ref: "inputs/request.md",
            artifacts_in: [],
        },
        outputs: {
            artifacts_out: [path.join("outputs", agentName, "result.json"), path.join("outputs", agentName, "notes.md")],
            summary_ref: summaryRef,
        },
        validation: {
            hard_checks: [],
            soft_checks: [],
        },
        execution: {
            status: "skipped",
            error: null,
            reason,
        },
        signals: {
            matched_keywords: [],
            confidence: null,
        },
        notes: {
            warnings: [],
        },
    };

    writeStepResult(runId, stepId, stepResult);
    const decision: DecisionAfterStep = {
        schema_version: "decision-after-step.v1",
        run_id: runId,
        step_id: stepId,
        decided_at: nowIso,
        decision: {
            action: "continue",
            reason: `skipped:${reason.code}`,
        },
        routing: {
            next_agent: null,
            next_model: null,
        },
        requirements: {
            required_inputs: [],
            human_prompt_ref: null,
        },
        constraints: {
            immutable_context: true,
            engine_smartness: "none",
        },
        audit: {
            policy_ids: ["gating-policy.v1"],
            rule_ids: [],
        },
    };
    writeDecision(runId, stepId, decision);
    writeEffectiveDecision(runId, stepId, decision);
    updateStepsIndex({
        runId,
        entry: {
            step_id: stepId,
            step_index: stepIndex,
            agent_name: agentName,
            status: "skipped",
            decision_action: decision.decision.action,
            model: stepResult.model,
            duration_ms: stepResult.timestamps.duration_ms,
        },
    });
}
