import fs from "fs";
import path from "path";
import type { StepsIndex, StepsIndexEntry } from "../../core/src/index.ts";

export interface StatusViewDeps {
    fs: {
        existsSync(path: string): boolean;
        statSync(path: string): { isFile(): boolean };
        readFileSync(path: string, encoding: "utf8"): string;
    };
}

const defaultDeps: StatusViewDeps = {
    fs: {
        existsSync: (p) => fs.existsSync(p),
        statSync: (p) => fs.statSync(p),
        readFileSync: (p, e) => fs.readFileSync(p, e),
    },
};

type DecisionFile = {
    decision: { action: string; reason: string };
    requirements?: { required_inputs?: string[]; human_prompt_ref?: string | null };
};

export type NormalizedStatus = {
    run_id: string;
    overall: "in_progress" | "finished_success" | "finished_failure" | "invalid" | "incomplete";
    artifacts_valid: boolean;
    errors: string[];
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

function normalize(raw: string | undefined): string {
    const r = (raw || "").toLowerCase().trim();
    if (["done", "success", "ok", "completed"].includes(r)) return "done";
    if (["failed", "error", "failure"].includes(r)) return "failed";
    if (["running", "in_progress", "active"].includes(r)) return "running";
    if (["skipped"].includes(r)) return "skipped";
    if (["blocked", "pending"].includes(r)) return "pending";
    return r || "unknown";
}

export function readStepsIndex(runDir: string, deps: StatusViewDeps = defaultDeps): StepsIndex | null {
    const indexPath = path.join(runDir, "steps", "index.json");
    if (!deps.fs.existsSync(indexPath) || !deps.fs.statSync(indexPath).isFile()) return null;
    try {
        const raw = deps.fs.readFileSync(indexPath, "utf8");
        return JSON.parse(raw) as StepsIndex;
    } catch {
        return null;
    }
}

function pickDecisionAction(runDir: string, stepId: string, deps: StatusViewDeps): { action: string; reason: string; required_inputs: string[]; paths: string[] } {
    const stepDir = path.join(runDir, "steps", stepId);
    const effectivePath = path.join(stepDir, "effective_decision.json");
    const basePath = path.join(stepDir, "decision_after_step.json");
    const humanPrompt = path.join(stepDir, "human_prompt.md");
    const resultPath = path.join(stepDir, "step_result.json");
    const { fs } = deps;

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

export function buildStatusView(runDir: string, deps: StatusViewDeps = defaultDeps): NormalizedStatus | null {
    const { fs } = deps;
    const runJsonPath = path.join(runDir, "run.json");
    /** @type {{ status?: string; exit_code?: number; run_id?: string; id?: string } | null} */
    let runJson: any = null;
    const errors: string[] = [];

    if (fs.existsSync(runJsonPath) && fs.statSync(runJsonPath).isFile()) {
        try {
            runJson = JSON.parse(fs.readFileSync(runJsonPath, "utf8"));
        } catch {
            errors.push("INVALID_JSON run.json");
        }
    } else {
        errors.push("MISSING run.json");
    }

    const index = readStepsIndex(runDir, deps);
    const stepsFromIndex = index ? [...index.steps].sort((a, b) => a.step_index - b.step_index) : [];
    if (!index) {
        errors.push("MISSING steps/index.json");
    }

    let is_blocked = false;
    let blocked_reason: string | null = null;
    let blocked_step_id: string | null = null;
    let next_action: NormalizedStatus["current_state"]["next_action"] = "none";
    let required_inputs: string[] = [];
    let paths: string[] = [];

    stepsFromIndex.forEach((entry: StepsIndexEntry) => {
        if (is_blocked) return;
        const decisionInfo = pickDecisionAction(runDir, entry.step_id, deps);
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

    const runId = runJson?.run_id || runJson?.id || index?.run_id || path.basename(runDir);
    const statusNorm = normalize(runJson?.status);
    const exitCode = typeof runJson?.exit_code === "number" ? runJson.exit_code : null;

    let overall: NormalizedStatus["overall"] = "incomplete";
    if (errors.length > 0) {
        overall = "invalid";
    } else if (statusNorm === "done" && exitCode === 0) {
        overall = "finished_success";
    } else if (statusNorm === "failed" || (exitCode !== null && exitCode > 0)) {
        overall = "finished_failure";
    } else if (statusNorm === "running" || statusNorm === "pending") {
        overall = "in_progress";
    }

    return {
        run_id: runId,
        overall,
        artifacts_valid: errors.length === 0,
        errors,
        steps: stepsFromIndex.map((s) => ({
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
