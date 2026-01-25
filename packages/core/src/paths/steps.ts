import path from "path";

export function getStepDir(runId: string, stepId: string) {
    return path.join("runs", runId, "steps", stepId);
}

export function getStepResultPath(runId: string, stepId: string) {
    return path.join(getStepDir(runId, stepId), "step_result.json");
}

export function getDecisionPath(runId: string, stepId: string) {
    return path.join(getStepDir(runId, stepId), "decision_after_step.json");
}

export function getStepsIndexPath(runId: string) {
    return path.join("runs", runId, "steps", "index.json");
}

export type StepsIndexEntry = {
    step_id: string;
    step_index: number;
    agent_name: string;
    status: "ok" | "failed" | "blocked";
    decision_action: "continue" | "halt" | "require_human" | "request_clarification";
    model?: import("../../../contracts/src/index.ts").ModelRef;
    duration_ms?: number;
};

export type StepsIndex = {
    schema_version: "steps-index.v1";
    run_id: string;
    updated_at: string;
    steps: StepsIndexEntry[];
};
