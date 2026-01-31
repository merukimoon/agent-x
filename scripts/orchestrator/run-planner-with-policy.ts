
import { OrchestratorService } from "../../packages/cli/src/index.js";
import process from "process";

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

async function main() {
    const { goal, context, explicitRunId } = parseArgs();

    // Delegate to Service
    const result = await OrchestratorService.runPlannerWithPolicy(goal, context, {
        explicitRunId,
        log: console.log
    });

    if (!result.success) {
        console.error(`Orchestrator failed with code ${result.exitCode}`);
        process.exit(result.exitCode || 1);
    }

    process.exit(0);
}

main().catch(err => {
    console.error("Orchestrator internal error:", err);
    process.exit(1);
});
