import fs from "fs";
import path from "path";
import type { StepsIndex, StepsIndexEntry } from "../../core/src/index.ts";

type DecisionFile = {
    decision: { action: string; reason: string };
    requirements?: { required_inputs?: string[]; human_prompt_ref?: string | null };
};

export type NormalizedStatus = {
    run_id: string;
    steps: Array<{
        step_index: number;
        step_id: string;
        agent_name: string;
        status: string;
        decision_action: string;
        model?: string;
        duration_ms?: number;
    }>;
    current_state: {
        is_blocked: boolean;
        blocked_reason: string | null;
        blocked_step_id: string | null;
        next_action: "none" | "provide_inputs" | "approve_or_override" | "retry_step" | "inspect_artifacts";
        required_inputs: string[];
        paths: string[];
    };
};

export function readStepsIndex(runDir: string): StepsIndex | null {
    const indexPath = path.join(runDir, "steps", "index.json");
    if (!fs.existsSync(indexPath) || !fs.statSync(indexPath).isFile()) return null;
    try {
        const raw = fs.readFileSync(indexPath, "utf8");
        return JSON.parse(raw) as StepsIndex;
    } catch {
        return null;
    }
}

function pickDecisionAction(runDir: string, stepId: string): { action: string; reason: string; required_inputs: string[]; paths: string[] } {
    const stepDir = path.join(runDir, "steps", stepId);
    const effectivePath = path.join(stepDir, "effective_decision.json");
    const basePath = path.join(stepDir, "decision_after_step.json");
    const humanPrompt = path.join(stepDir, "human_prompt.md");
    const resultPath = path.join(stepDir, "step_result.json");

    const paths: string[] = [];
    let required_inputs: string[] = [];
    let action = "continue";
    let reason = "";

    const readDecision = (p: string): DecisionFile | null => {
        if (!fs.existsSync(p) || !fs.statSync(p).isFile()) return null;
        try {
            const raw = fs.readFileSync(p, "utf8");
            return JSON.parse(raw) as DecisionFile;
        } catch {
            return null;
        }
    };

    const effective = readDecision(effectivePath);
    const base = readDecision(basePath);
    const chosen = effective ?? base;

    if (chosen?.decision?.action) {
        action = chosen.decision.action;
        reason = chosen.decision.reason ?? "";
        required_inputs = chosen.requirements?.required_inputs ?? [];
    }

    if (fs.existsSync(humanPrompt) && fs.statSync(humanPrompt).isFile()) {
        paths.push(path.relative(runDir, humanPrompt));
    }
    if (fs.existsSync(basePath) && fs.statSync(basePath).isFile()) {
        paths.push(path.relative(runDir, basePath));
    }
    if (fs.existsSync(effectivePath) && fs.statSync(effectivePath).isFile()) {
        paths.push(path.relative(runDir, effectivePath));
    }
    if (fs.existsSync(resultPath) && fs.statSync(resultPath).isFile()) {
        paths.push(path.relative(runDir, resultPath));
    }

    return { action, reason, required_inputs, paths };
}

export function buildStatusView(runDir: string): NormalizedStatus | null {
    const index = readStepsIndex(runDir);
    if (!index) return null;
    const steps = [...index.steps].sort((a, b) => a.step_index - b.step_index);

    let is_blocked = false;
    let blocked_reason: string | null = null;
    let blocked_step_id: string | null = null;
    let next_action: NormalizedStatus["current_state"]["next_action"] = "none";
    let required_inputs: string[] = [];
    let paths: string[] = [];

    steps.forEach((entry: StepsIndexEntry) => {
        if (is_blocked) return;
        const decisionInfo = pickDecisionAction(runDir, entry.step_id);
        if (entry.status === "blocked" || decisionInfo.action === "require_human" || decisionInfo.action === "request_clarification") {
            is_blocked = true;
            blocked_reason = decisionInfo.reason || `decision: ${decisionInfo.action}`;
            blocked_step_id = entry.step_id;
            required_inputs = decisionInfo.required_inputs;
            paths = decisionInfo.paths;
            next_action = decisionInfo.action === "request_clarification"
                ? "provide_inputs"
                : "approve_or_override";
        } else if (entry.status === "failed") {
            is_blocked = true;
            blocked_reason = `step failed: ${entry.step_id}`;
            blocked_step_id = entry.step_id;
            paths = decisionInfo.paths;
            next_action = "inspect_artifacts";
        }
    });

    return {
        run_id: index.run_id,
        steps: steps.map((s) => ({
            step_index: s.step_index,
            step_id: s.step_id,
            agent_name: s.agent_name,
            status: s.status,
            decision_action: s.decision_action,
            model: s.model ? `${s.model.provider}/${s.model.name}` : undefined,
            duration_ms: s.duration_ms,
        })),
        current_state: {
            is_blocked,
            blocked_reason,
            blocked_step_id,
            next_action,
            required_inputs,
            paths,
        },
    };
}
