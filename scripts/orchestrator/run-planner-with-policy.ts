
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import process from "process";

// Configuration
const MAX_RETRIES = 2; // Total attempts = 1 + N
const BACKOFF_MS = 2000;

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseArgs() {
    const args = process.argv.slice(2);
    let goal = "";
    let context = "";
    let explicitRunId = "";

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === "--goal") {
            goal = args[++i];
        } else if (arg === "--context") {
            context = args[++i];
        } else if (arg === "--run") {
            explicitRunId = args[++i];
        }
    }

    if (!goal) {
        console.error("Error: --goal is required");
        process.exit(1);
    }

    return { goal, context, explicitRunId };
}

function runPlanner(runId: string, goal: string, context: string) {
    const scriptPath = path.join(process.cwd(), "scripts", "agentic.ts");

    // Construct the command arguments
    // equivalent to: node --import tsx scripts/agentic.ts planner --run ...
    const nodeArgs = [
        "--import",
        "tsx",
        scriptPath,
        "planner",
        "--run",
        runId,
        "--goal",
        goal,
    ];

    if (context) {
        nodeArgs.push("--context", context);
    }

    console.log(`[Orchestrator] Invoking Planner (RunID: ${runId})...`);

    const result = spawn(process.execPath, nodeArgs, {
        stdio: "inherit", // Pipe output directly to user
        cwd: process.cwd(),
        env: process.env,
    });

    return new Promise<number>((resolve) => {
        result.on("close", (code) => {
            resolve(code ?? 1);
        });
    });
}

function getRunArtifacts(runId: string) {
    const runDir = path.join(process.cwd(), "runs", runId);
    const validationErrorPath = path.join(runDir, "planner_validation_error.json");
    const validReportPath = path.join(runDir, "planner_validation.json");

    let errorDetails = null;
    if (fs.existsSync(validationErrorPath)) {
        try {
            errorDetails = JSON.parse(fs.readFileSync(validationErrorPath, "utf8"));
        } catch (e) { /* ignore */ }
    }

    let validReport = null;
    if (fs.existsSync(validReportPath)) {
        try {
            validReport = JSON.parse(fs.readFileSync(validReportPath, "utf8"));
        } catch (e) { /* ignore */ }
    }

    return { errorDetails, validReport };
}

async function main() {
    const { goal, context, explicitRunId } = parseArgs();

    // Use provided ID or generate a base one. 
    // For retries, we might want to append suffixes or reuse the same ID? 
    // The constraints say "retry". Usually retry means re-execution. 
    // If we reuse the runID, we overwrite artifacts. This is probably desired for "retry until success".
    // However, useful debugging might want separate IDs. 
    // Let's use the same RunID to keep the "logical run" together, assuming the planner overwrites.
    // Actually, the planner tool creates the directory if missing. It overwrites files.

    const baseRunId = explicitRunId || `orch-${new Date().toISOString().replace(/[:.]/g, "-")}`;

    let attempt = 0;

    while (attempt <= MAX_RETRIES) {
        attempt++;
        const currentRunId = attempt > 1 ? `${baseRunId}-retry${attempt - 1}` : baseRunId;

        console.log(`\n=== Orchestrator Policy Loop: Attempt ${attempt}/${MAX_RETRIES + 1} ===`);

        // We run the planner synchronously to wait for exit code
        const exitCode = await runPlanner(currentRunId, goal, context);

        console.log(`[Orchestrator] Planner exited with code: ${exitCode}`);

        const { errorDetails, validReport } = getRunArtifacts(currentRunId);

        if (exitCode === 0) {
            console.log("\n✅ [SUCCESS] Plan generated and validated.");
            if (validReport) {
                if (validReport.warnings?.length) {
                    console.log("Warnings:", validReport.warnings);
                }
            }
            process.exit(0);
        }
        else if (exitCode === 10) {
            console.log("⚠️ [RETRYABLE] Exit Code 10 (Network/Internal).");
            if (errorDetails) {
                console.log(`Details: ${errorDetails.message}`);
            }

            if (attempt <= MAX_RETRIES) {
                console.log(`Backing off for ${BACKOFF_MS}ms before retry...`);
                await sleep(BACKOFF_MS);
                continue; // Retry loop
            } else {
                console.error("❌ [FAILED] Max retries exhausted.");
                process.exit(10);
            }
        }
        else if (exitCode === 11) {
            console.error("❌ [FATAL] Exit Code 11 (Parse/Schema).");
            console.error("Guidance: Refine your prompt or fix the schema. Do not retry.");
            if (errorDetails) {
                console.log(`Error Type: ${errorDetails.error_type}`);
                console.log(`Message: ${errorDetails.message}`);
            }
            process.exit(11);
        }
        else if (exitCode === 12) {
            console.error("⛔ [BLOCKED] Exit Code 12 (Safety/Policy).");
            console.error("Guidance: Safety violation. Do not retry.");
            if (errorDetails) {
                console.log(`Violations: ${JSON.stringify(errorDetails.details)}`);
            }
            process.exit(12);
        }
        else {
            console.error(`❌ [UNKNOWN] Exit Code ${exitCode}.`);
            process.exit(exitCode);
        }
    }
}

main().catch(err => {
    console.error("Orchestrator internal error:", err);
    process.exit(1);
});
