
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

function runAgent(agent: string, runId: string, extraArgs: string[] = []) {
    const scriptPath = path.join(process.cwd(), "scripts", "agentic.ts");

    // equivalent to: node --import tsx scripts/agentic.ts agent <name> --run ...
    const nodeArgs = [
        "--import",
        "tsx",
        scriptPath,
        agent === "planner" ? "planner" : "agent",
        ...(agent === "planner" ? [] : [agent]),
        "--run",
        runId,
        ...extraArgs,
    ];

    console.log(`[Orchestrator] Invoking ${agent} (RunID: ${runId})...`);

    const result = spawn(process.execPath, nodeArgs, {
        stdio: "inherit",
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
    const baseRunId = explicitRunId || `orch-flow-${new Date().toISOString().replace(/[:.]/g, "-")}`;

    // === STEP 1: PLANNER ===
    let attempt = 0;
    let plannerSuccess = false;

    while (attempt <= MAX_RETRIES) {
        attempt++;
        const currentRunId = baseRunId; // Use single RunID for the flow to keep artifacts together

        console.log(`\n=== Step 1: Planner (Attempt ${attempt}/${MAX_RETRIES + 1}) ===`);

        const plannerArgs = ["--goal", goal];
        if (context) {
            plannerArgs.push("--context", context);
        }

        const exitCode = await runAgent("planner", currentRunId, plannerArgs);
        console.log(`[Orchestrator] Planner exited with code: ${exitCode}`);

        if (exitCode === 0) {
            console.log("\n✅ [planner] Plan generated and validated.");
            plannerSuccess = true;
            break;
        } else if (exitCode === 10) {
            console.log("⚠️ [RETRYABLE] Exit Code 10 (Network/Internal).");
            if (attempt <= MAX_RETRIES) {
                console.log(`Backing off for ${BACKOFF_MS}ms...`);
                await sleep(BACKOFF_MS);
                continue;
            }
        } else if (exitCode === 11 || exitCode === 12) {
            console.error(`❌ [FAILED] Exit Code ${exitCode} (Fatal).`);
            process.exit(exitCode);
        } else {
            process.exit(exitCode);
        }
    }

    if (!plannerSuccess) {
        console.error("❌ [FAILED] Planner failed after retries.");
        process.exit(10);
    }

    // === HANDOFF: PREPARE CONTEXT ===
    const runDir = path.join(process.cwd(), "runs", baseRunId);
    const plannerSummaryPath = path.join(runDir, "planner_summary.md");
    const contextWithPlanPath = path.join(runDir, "inputs", "context_with_plan.md");

    if (!fs.existsSync(plannerSummaryPath)) {
        console.error("❌ [ERROR] Planner summary not found.");
        process.exit(1);
    }

    let contextContent = "";
    if (context && fs.existsSync(context)) {
        contextContent = fs.readFileSync(context, "utf8");
    } else {
        contextContent = context || "";
    }

    const plannerSummary = fs.readFileSync(plannerSummaryPath, "utf8");
    const combinedContext = `${contextContent}\n\n# Prior Plan\n\n${plannerSummary}`;

    // Ensure inputs dir exists (it should, from planner run)
    if (!fs.existsSync(path.dirname(contextWithPlanPath))) {
        fs.mkdirSync(path.dirname(contextWithPlanPath), { recursive: true });
    }
    fs.writeFileSync(contextWithPlanPath, combinedContext);
    console.log(`\n📄 [HANDOFF] Context prepared at ${contextWithPlanPath}`);

    // Create inputs/request.md (Required by standard agent runtime)
    const requestPath = path.join(runDir, "inputs", "request.md");
    fs.writeFileSync(requestPath, goal);

    // Create inputs/context.md (Required by standard agent runtime, even if we override it later)
    const standardContextPath = path.join(runDir, "inputs", "context.md");
    if (!fs.existsSync(standardContextPath)) {
        fs.writeFileSync(standardContextPath, contextContent);
    }

    console.log(`📄 [HANDOFF] Standard inputs prepared.`);

    // === STEP 2: ARCHITECT ===
    console.log(`\n=== Step 2: Architect ===`);
    // Architect uses the standard 'agent' command, but we pass the DERIVED context
    const archExitCode = await runAgent("architect", baseRunId, ["--context", contextWithPlanPath]);

    console.log(`[Orchestrator] Architect exited with code: ${archExitCode}`);

    if (archExitCode !== 0) {
        console.error(`❌ [FAILED] Architect failed with code ${archExitCode}.`);
        process.exit(archExitCode);
    }

    // === STEP 3: SUMMARY ===

    const flowSummaryPath = path.join(runDir, "flow_summary.md");
    const archNotesPath = path.join(runDir, "outputs", "architect", "notes.md");
    let archNotes = "No architect notes produced.";
    if (fs.existsSync(archNotesPath)) {
        archNotes = fs.readFileSync(archNotesPath, "utf8");
    }

    const flowSummary = `# Flow Summary: Planner → Architect

**Run ID**: ${baseRunId}
**Goal**: ${goal}
**Status**: SUCCESS

## Planner Output
See [Plan Summary](planner_summary.md)

## Architect Output
See [Architect Notes](outputs/architect/notes.md) and [Structured Result](outputs/architect/result.json).

### Architect Notes Preview
${archNotes.split('\n').slice(0, 10).join('\n')}... (see full file)

## Interpretation
The planner has scoped the work, and the architect has reviewed it for feasibility and design alignment.
`;

    fs.writeFileSync(flowSummaryPath, flowSummary);
    console.log(`\n✅ [SUCCESS] Flow complete. Summary saved to ${flowSummaryPath}`);
}

main().catch(err => {
    console.error("Orchestrator internal error:", err);
    process.exit(1);
});
