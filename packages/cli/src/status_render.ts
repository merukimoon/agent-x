import type { NormalizedStatus } from "./status_view.ts";

export function renderStatusView(view: NormalizedStatus, lockStatus: string | null = null): string {
    const lines: string[] = [];
    lines.push(`Run: ${view.run_id}`);
    lines.push(`Steps: ${view.steps.length}`);
    if (lockStatus) lines.push(lockStatus);
    const blocked = view.current_state.is_blocked;
    lines.push(`Overall: ${view.overall.toUpperCase()}`);
    lines.push(`State: ${blocked ? "BLOCKED" : "OK"}`);
    if (view.errors.length) {
        lines.push("Errors:");
        view.errors.forEach((e) => lines.push(`- ${e}`));
    }
    if (blocked) {
        lines.push(`Blocked step: ${view.current_state.blocked_step_id ?? "-"}`);
        lines.push(`Reason: ${view.current_state.blocked_reason ?? "-"}`);
        lines.push(`Next action: ${view.current_state.next_action}`);
        if (view.current_state.required_inputs.length) {
            lines.push("Required inputs:");
            view.current_state.required_inputs.forEach((r) => lines.push(`- ${r}`));
        }
        if (view.current_state.paths.length) {
            lines.push("Relevant files:");
            view.current_state.paths.forEach((p) => lines.push(`- ${p}`));
        }
    }
    lines.push("");
    lines.push("idx agent            status       decision    model                duration_ms");
    view.steps.forEach((s) => {
        lines.push(
            `${String(s.step_index).padEnd(3, " ")} ${s.agent_name.padEnd(15, " ")} ${s.status.padEnd(12, " ")} ${s.decision_action.padEnd(11, " ")} ${String(s.model ?? "-").padEnd(20, " ")} ${s.duration_ms ?? "-"}`
        );
    });
    return lines.join("\n");
}
