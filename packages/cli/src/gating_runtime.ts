import fs from "fs";
import path from "path";
import type { DecisionAfterStep, StepOverride, StepResult } from "../../core/src/contracts/step.ts";
import type { GateOutcome, GatingPolicy, Strictness } from "../../core/src/policy/gating.ts";
import { evaluateGates, resolveStrictness } from "../../core/src/policy/gating.ts";
import { getDecisionPath, getStepDir } from "../../core/src/paths/steps.ts";
import { writeJsonAtomic } from "./step_persistence.ts";

const DEFAULT_POLICY: GatingPolicy = {
    schema_version: "gating-policy.v1",
    system_default: { strictness: "soft" },
    pipelines: {},
    agents: {},
    steps: {},
};

export function loadGatingPolicy(): GatingPolicy {
    const overrideEnv = process.env.GATING_POLICY_PATH;
    const policyPath = overrideEnv ? path.resolve(overrideEnv) : path.join(process.cwd(), "config", "gating_policy.json");
    if (!fs.existsSync(policyPath)) return DEFAULT_POLICY;
    try {
        const raw = fs.readFileSync(policyPath, "utf8");
        const parsed = JSON.parse(raw) as GatingPolicy;
        if (parsed.schema_version !== "gating-policy.v1") return DEFAULT_POLICY;
        return parsed;
    } catch {
        return DEFAULT_POLICY;
    }
}

export function determineStrictness(policy: GatingPolicy, opts: { pipeline_id?: string | null; agent_name?: string | null; step_id?: string | null; }): Strictness {
    return resolveStrictness(policy, opts);
}

export function evaluateStepGates(stepResult: StepResult, strictness: Strictness): GateOutcome {
    return evaluateGates(stepResult, strictness);
}

export function readOverride(runId: string, stepId: string): StepOverride | null {
    const candidates = [
        path.join(getStepDir(runId, stepId), "override.json"),
        path.join(process.cwd(), "runs", runId, "outputs", stepId, "override.json"),
    ];
    for (const overridePath of candidates) {
        if (!fs.existsSync(overridePath) || !fs.statSync(overridePath).isFile()) continue;
        try {
            const raw = fs.readFileSync(overridePath, "utf8");
            const parsed = JSON.parse(raw) as StepOverride;
            if (parsed.schema_version !== "step-override.v1") continue;
            if (parsed.run_id !== runId || parsed.step_id !== stepId) continue;
            return parsed;
        } catch {
            continue;
        }
    }
    return null;
}

export function applyOverride(params: {
    baseDecision: DecisionAfterStep;
    override: StepOverride | null;
    gateOutcome: GateOutcome;
}): DecisionAfterStep {
    const { baseDecision, override, gateOutcome } = params;
    if (!override) return baseDecision;
    const allowedBase = baseDecision.decision.action === "require_human" || baseDecision.decision.action === "request_clarification";
    if (!allowedBase) return baseDecision;

    const allowedActions: DecisionAfterStep["decision"]["action"][] = [
        "continue",
        "halt",
        "require_human",
        "request_clarification",
    ];
    if (!allowedActions.includes(override.override_action as any)) return baseDecision;

    if (gateOutcome.gate_status === "hard_fail" && override.override_action === "continue") {
        return baseDecision;
    }

    return {
        ...baseDecision,
        decision: {
            action: override.override_action as DecisionAfterStep["decision"]["action"],
            reason: `override by ${override.actor.type}:${override.actor.id}`,
        },
        routing: override.routing_override ?? baseDecision.routing,
    };
}

export function writeEffectiveDecision(runId: string, stepId: string, decision: DecisionAfterStep) {
    const decisionPath = path.join(getStepDir(runId, stepId), "effective_decision.json");
    writeJsonAtomic(decisionPath, decision);
}
