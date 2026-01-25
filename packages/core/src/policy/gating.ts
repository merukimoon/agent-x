import type { CheckResult, StepResult } from "../../../contracts/src/index.ts";

export type Strictness = "soft" | "hard";

export type GatingPolicy = {
    schema_version: "gating-policy.v1";
    system_default: { strictness: Strictness };
    pipelines?: Record<string, { strictness: Strictness }>;
    agents?: Record<string, { strictness: Strictness }>;
    steps?: Record<string, { strictness: Strictness }>;
};

export type GateOutcome = {
    gate_status: "pass" | "soft_fail" | "hard_fail";
    hard_failed_ids: string[];
    soft_failed_ids: string[];
    notes: string[];
};

export function resolveStrictness(policy: GatingPolicy, args: {
    pipeline_id?: string | null;
    agent_name?: string | null;
    step_id?: string | null;
}): Strictness {
    const stepStrict = args.step_id ? policy.steps?.[args.step_id]?.strictness : undefined;
    if (stepStrict) return stepStrict;
    const agentStrict = args.agent_name ? policy.agents?.[args.agent_name]?.strictness : undefined;
    if (agentStrict) return agentStrict;
    const pipelineStrict = args.pipeline_id ? policy.pipelines?.[args.pipeline_id]?.strictness : undefined;
    if (pipelineStrict) return pipelineStrict;
    return policy.system_default.strictness;
}

export function evaluateGates(stepResult: StepResult, strictness: Strictness): GateOutcome {
    const hardFailedIds = collectFailedIds(stepResult.validation?.hard_checks);
    const softFailedIds = collectFailedIds(stepResult.validation?.soft_checks);

    if (hardFailedIds.length > 0) {
        return {
            gate_status: "hard_fail",
            hard_failed_ids: hardFailedIds,
            soft_failed_ids: softFailedIds,
            notes: [`hard checks failed: ${hardFailedIds.join(", ")}`],
        };
    }

    if (softFailedIds.length > 0) {
        return {
            gate_status: "soft_fail",
            hard_failed_ids: [],
            soft_failed_ids: softFailedIds,
            notes: [`soft checks failed: ${softFailedIds.join(", ")}`],
        };
    }

    return {
        gate_status: "pass",
        hard_failed_ids: [],
        soft_failed_ids: [],
        notes: [],
    };
}

function collectFailedIds(checks: CheckResult[] | undefined) {
    if (!Array.isArray(checks)) return [];
    return checks.filter((c) => c && c.ok === false).map((c) => c.id || "unknown");
}
