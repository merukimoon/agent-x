export type ModelRef = {
    provider: string;
    name: string;
    mode: string;
    temperature: number | null;
};

export type ArtifactRef = string;

export type CheckResult = {
    id: string;
    ok: boolean;
    message: string;
};

export type ExecutionStatus = "ok" | "failed" | "blocked";

export interface StepResult {
    schema_version: "step-result.v1";
    run_id: string;
    step_id: string;
    step_index: number;
    agent_name: string;
    model: ModelRef;
    timestamps: {
        started_at: string;
        finished_at: string;
        duration_ms: number;
    };
    inputs: {
        context_ref: string;
        request_ref: string;
        artifacts_in: ArtifactRef[];
    };
    outputs: {
        artifacts_out: ArtifactRef[];
        summary_ref: string | null;
    };
    validation: {
        hard_checks: CheckResult[];
        soft_checks: CheckResult[];
    };
    execution: {
        status: ExecutionStatus;
        error: Record<string, unknown> | null;
    };
    signals: {
        matched_keywords: string[];
        confidence: number | null;
    };
    notes: {
        warnings: string[];
    };
}

export interface DecisionAfterStep {
    schema_version: "decision-after-step.v1";
    run_id: string;
    step_id: string;
    decided_at: string;
    decision: {
        action: "continue" | "halt" | "require_human" | "request_clarification";
        reason: string;
    };
    routing: {
        next_agent: string | null;
        next_model: ModelRef | null;
    };
    requirements: {
        required_inputs: string[];
        human_prompt_ref: string | null;
    };
    constraints: {
        immutable_context: true;
        engine_smartness: "none";
    };
    audit: {
        policy_ids: string[];
        rule_ids: string[];
    };
}

export interface StepOverride {
    schema_version: "step-override.v1";
    run_id: string;
    step_id: string;
    actor: {
        type: string;
        id: string;
    };
    override_action: string;
    routing_override: {
        next_agent: string | null;
        next_model: ModelRef | null;
    } | null;
    acknowledged_risks: string[];
}
