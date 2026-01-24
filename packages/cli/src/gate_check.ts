import fs from "fs";
import path from "path";

export type GateInfo = {
    run_id: string;
    step_id: string;
    decision_action: string;
    human_prompt: string;
    decision_after: string;
    effective_decision: string;
    override_path: string;
    required_inputs: string[];
};

const GATE_ACTIONS = new Set(["require_human", "request_clarification", "requires_human"]);

export function detectGate(runDir: string): GateInfo | null {
    const indexPath = path.join(runDir, "steps", "index.json");
    if (!fs.existsSync(indexPath) || !fs.statSync(indexPath).isFile()) return null;
    let parsed: any = null;
    try {
        parsed = JSON.parse(fs.readFileSync(indexPath, "utf8"));
    } catch {
        return null;
    }
    const steps = Array.isArray(parsed?.steps) ? parsed.steps.slice() : [];
    steps.sort((a, b) => (a?.step_index ?? 0) - (b?.step_index ?? 0));
    const blocked = steps.find((s) => GATE_ACTIONS.has(s?.decision_action));
    if (!blocked) return null;

    const stepId = blocked.step_id;
    const overrideOutputs = path.join(runDir, "outputs", blocked.agent_name ?? stepId, "override.json");
    const overrideStep = path.join(runDir, "steps", stepId, "override.json");
    if (fs.existsSync(overrideOutputs) || fs.existsSync(overrideStep)) {
        return null;
    }
    const stepDir = path.join(runDir, "steps", stepId);
    const humanPrompt = path.join(stepDir, "human_prompt.md");
    const decisionAfter = path.join(stepDir, "decision_after_step.json");
    const effectiveDecision = path.join(stepDir, "effective_decision.json");
    const overridePath = path.join(stepDir, "override.json");
    const requiredInputs = Array.isArray(blocked?.required_inputs) ? blocked.required_inputs : [];

    return {
        run_id: parsed?.run_id ?? path.basename(runDir),
        step_id: stepId,
        decision_action: blocked.decision_action,
        human_prompt: humanPrompt,
        decision_after: decisionAfter,
        effective_decision: effectiveDecision,
        override_path: overridePath,
        required_inputs: requiredInputs,
    };
}
