import path from "path";
import fs from "fs";
import { runAgent } from "../agents";
import { Core, Legacy } from "../imports";

const { OrchestratorExitCode, OrchestratorPolicy } = Core;
const { writeJsonFile, writeFileAtomic } = Legacy;

export type OrchestratorResult = {
    success: boolean;
    runId: string;
    exitCode: number;
};

export class OrchestratorService {
    /**
     * Run the planner agent with policy (retries on network errors, etc.)
     */
    static async runPlannerWithPolicy(
        goal: string,
        context: string,
        options: { explicitRunId?: string; log?: (msg: string) => void } = {}
    ): Promise<OrchestratorResult> {
        const log = options.log || console.log;
        const baseRunId = options.explicitRunId || `orch-${new Date().toISOString().replace(/[:.]/g, "-")}`;

        log(`RUN_ID=${baseRunId}`);

        let attempt = 0;
        while (attempt <= OrchestratorPolicy.MAX_RETRIES) {
            attempt++;
            // For retries involving potential file corruption or state, strategies vary.
            // Here we assume a fresh run ID for each attempt if we wanted isolation, 
            // but the requirement implies "retrying the task".
            // The original script used `currentRunId` based on attempt suffix.
            const currentRunId = attempt > 1 ? `${baseRunId}-retry${attempt - 1}` : baseRunId;

            log(`\n=== Orchestrator Policy Loop: Attempt ${attempt}/${OrchestratorPolicy.MAX_RETRIES + 1} ===`);
            log(`[Orchestrator] Invoking Planner (RunID: ${currentRunId})...`);

            // Set up inputs (similar to scaffold, but strictly for this run)
            const runDir = path.join(process.cwd(), "runs", currentRunId);
            const inputsDir = path.join(runDir, "inputs");
            fs.mkdirSync(inputsDir, { recursive: true });
            fs.writeFileSync(path.join(inputsDir, "request.md"), goal);

            let contextValue = context;
            if (context && fs.existsSync(context)) {
                // If context is a file path, read it
                try {
                    contextValue = fs.readFileSync(context, "utf8");
                } catch (e) {
                    // treat as raw string if file fails
                }
            }
            fs.writeFileSync(path.join(inputsDir, "context.md"), contextValue || "");

            // Execute Agent
            // runAgent is now async and handles calling the LLM
            const agentResult = await runAgent("planner", currentRunId, "live");

            // Determine Exit Code to feed Policy
            let exitCode = OrchestratorExitCode.UNKNOWN_ERROR;

            if (agentResult.status === "done") {
                exitCode = OrchestratorExitCode.SUCCESS;
            } else {
                // Check for specific error artifacts
                const errorPath = path.join(runDir, "planner_validation_error.json");
                if (fs.existsSync(errorPath)) {
                    try {
                        const errJson = JSON.parse(fs.readFileSync(errorPath, "utf8"));
                        if (errJson.error_type === "llm_error") {
                            exitCode = OrchestratorExitCode.RETRYABLE_NETWORK;
                        } else if (errJson.error_type === "validation") {
                            // Validation failures are generally not retryable networks errors, but effectively "parse" errors from LLM.
                            // If the prompt is static, retrying might not help unless temp > 0.
                            // The policy says FATAL_PARSE = 11.
                            exitCode = OrchestratorExitCode.FATAL_PARSE;
                        }
                    } catch {
                        // bad json
                        exitCode = OrchestratorExitCode.UNKNOWN_ERROR;
                    }
                } else {
                    // Failed but no detailed error?
                    exitCode = OrchestratorExitCode.UNKNOWN_ERROR;
                }
            }

            log(`[Orchestrator] Planner finished with code: ${exitCode}`);

            const decision = OrchestratorPolicy.evaluateExitCode(exitCode, attempt);

            if (decision.action === 'success') {
                log("\n✅ [SUCCESS] Plan generated and validated.");
                // We might want to "finalize" the run here or just return.
                // Existing script wrote a summary. runAgent does write standard artifacts.
                // We can replicate the "writePlannerRunArtifacts" summary logic if needed, 
                // but runAgent handles standard notes/results.
                // The legacy script wrote a top-level plan.json/run.json manually. 
                // runAgent writes outputs/planner/result.json.
                // We should ensure plan.json exists for the run to be valid 'Agentic' run.
                // Since `planner` just outputs a JSON, we might need to convert it to a plan.json in the run root?
                // The `planner` agent in `agents.ts` writes `resultPath` (outputs/planner/result.json).
                // It does NOT write `plan.json` in the root.

                // ADAPTATION: Copy planner outcome to root plan.json?
                // The legacy script did `fs.writeFileSync(path.join(runDir, "plan.json"), ...)` manually constructing it.
                // We should probably do that here to maintain behavior.

                const plannerResultPath = path.join(runDir, "outputs", "planner", "result.json");
                if (fs.existsSync(plannerResultPath)) {

                    // Manually construct for now to match legacy
                    const planContent = JSON.parse(fs.readFileSync(plannerResultPath, "utf8"));

                    // If the planner returns a "plan" object, we use it.
                    // The prompt asks for a specific JSON structure.
                    // We assume it matches.

                    // Actually, let's just copy it to plan.json
                    fs.writeFileSync(path.join(runDir, "plan.json"), JSON.stringify(planContent, null, 2));
                }

                return { success: true, runId: currentRunId, exitCode: 0 };
            }

            if (decision.action === 'retry') {
                log(`⚠️ [RETRYABLE] ${decision.reason}`);
                if (decision.backoffMs) {
                    log(`Backing off for ${decision.backoffMs}ms...`);
                    await new Promise(r => setTimeout(r, decision.backoffMs));
                }
                continue;
            }

            if (decision.action === 'fail') {
                log(`❌ [FAILED] ${decision.reason}`);
                return { success: false, runId: currentRunId, exitCode: exitCode };
            }
        }

        return { success: false, runId: baseRunId, exitCode: OrchestratorExitCode.UNKNOWN_ERROR };
    }
}
