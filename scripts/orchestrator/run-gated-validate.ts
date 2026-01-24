import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";

function parseArgs() {
  const args = process.argv.slice(2);
  let goal = "";
  let context = "";
  let runId = "";
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--goal") goal = args[++i] || "";
    else if (arg === "--context") context = args[++i] || "";
    else if (arg === "--run") runId = args[++i] || "";
  }
  if (!goal) {
    console.error("GOAL is required (--goal \"...\")");
    process.exit(1);
  }
  return { goal, context, runId };
}

function ensureDirs(runDir: string) {
  fs.mkdirSync(runDir, { recursive: true });
  fs.mkdirSync(path.join(runDir, "inputs"), { recursive: true });
  fs.mkdirSync(path.join(runDir, "summary"), { recursive: true });
}

function writeInputs(runDir: string, goal: string, context: string) {
  fs.writeFileSync(path.join(runDir, "inputs", "request.md"), goal, "utf8");
  fs.writeFileSync(path.join(runDir, "inputs", "context.md"), context ?? "", "utf8");
}

function writePlan(runDir: string, runId: string) {
  const plan = {
    run_id: runId,
    created_at_utc: new Date().toISOString(),
    version: "0.1",
    flow_type: "orchestrator-gated-validate",
    rationale: "gated validation demo",
    signals: [],
    confidence: "low",
    steps: [
      {
        id: "coordinator",
        agent: "coordinator",
        depends_on: [],
        inputs: {
          request: "inputs/request.md",
          context: "inputs/context.md",
          prior_outputs: [],
        },
        outputs: {
          result: "outputs/coordinator/result.json",
          notes: "outputs/coordinator/notes.md",
          status: "outputs/coordinator/status.json",
        },
        status: "done",
        attempt: 0,
        max_attempts: 1,
        last_error: null,
        allow_skip: false,
      },
      {
        id: "human_gate",
        agent: "human_gate",
        depends_on: ["coordinator"],
        inputs: {
          request: "inputs/request.md",
          context: "inputs/context.md",
          prior_outputs: ["outputs/coordinator/result.json"],
        },
        outputs: {
          result: "outputs/human_gate/result.json",
          notes: "outputs/human_gate/notes.md",
          status: "outputs/human_gate/status.json",
        },
        status: "pending",
        attempt: 0,
        max_attempts: 1,
        last_error: null,
        allow_skip: false,
      },
      {
        id: "step-1",
        agent: "decision-maker",
        depends_on: ["human_gate"],
        inputs: {
          request: "inputs/request.md",
          context: "inputs/context.md",
          prior_outputs: ["outputs/human_gate/result.json"],
        },
        outputs: {
          result: "outputs/decision-maker/result.json",
          notes: "outputs/decision-maker/notes.md",
          status: "outputs/decision-maker/status.json",
        },
        status: "pending",
        attempt: 0,
        max_attempts: 1,
        last_error: null,
        allow_skip: true,
      },
    ],
  };
  fs.writeFileSync(path.join(runDir, "plan.json"), JSON.stringify(plan, null, 2), "utf8");
}

function writeRunJson(runDir: string, runId: string) {
  const now = new Date().toISOString();
  const runJson = {
    id: runId,
    run_id: runId,
    flow: "orchestrator-gated-validate",
    status: "in_progress",
    created_at_utc: now,
    started_at_utc: now,
    exit_code: null,
    error: null,
  };
  fs.writeFileSync(path.join(runDir, "run.json"), JSON.stringify(runJson, null, 2), "utf8");
}

function writeCoordinatorOutputs(runDir: string, runId: string) {
  const outDir = path.join(runDir, "outputs", "coordinator");
  fs.mkdirSync(outDir, { recursive: true });
  const createdAt = new Date().toISOString();
  const result = {
    agent: "coordinator",
    run_id: runId,
    status: "done",
    created_at_utc: createdAt,
    summary: "Coordinator stub for gated demo",
    mode: "live",
  };
  fs.writeFileSync(path.join(outDir, "result.json"), JSON.stringify(result, null, 2));
  fs.writeFileSync(path.join(outDir, "notes.md"), "Coordinator stub\n", "utf8");
  fs.writeFileSync(
    path.join(outDir, "status.json"),
    JSON.stringify(
      {
        agent: "coordinator",
        run_id: runId,
        status: "done",
        created_at_utc: createdAt,
        finished_at_utc: createdAt,
        mode: "live",
      },
      null,
      2
    )
  );
}

function writeSummary(runDir: string, runId: string) {
  const now = new Date().toISOString();
  const summary = [
    "# Run summary",
    "",
    `- Run: ${runId}`,
    "- Flow: orchestrator-gated-validate",
    `- Status: in_progress`,
    `- Started: ${now}`,
    "",
    "## Steps",
    "- coordinator (coordinator): done",
    "- human_gate (human_gate): pending",
    "- step-1 (decision-maker): pending",
    "",
    "## Key artifacts",
    "- run.json",
    "- plan.json",
  ].join("\n");
  fs.writeFileSync(path.join(runDir, "summary", "final.md"), summary, "utf8");
}

function main() {
  const { goal, context, runId } = parseArgs();
  const effectiveRunId = runId || `gated-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  const runDir = path.join(process.cwd(), "runs", effectiveRunId);
  ensureDirs(runDir);
  writeInputs(runDir, goal, context);
  writePlan(runDir, effectiveRunId);
  writeRunJson(runDir, effectiveRunId);
  writeCoordinatorOutputs(runDir, effectiveRunId);
  writeSummary(runDir, effectiveRunId);

  console.log(`RUN_ID=${effectiveRunId}`);
  console.log(`Starting gated flow for ${effectiveRunId} ...`);

  const result = spawnSync(process.execPath, ["--import", "tsx", path.join(process.cwd(), "scripts", "agentic.ts"), "flow", "--run", effectiveRunId], {
    stdio: "inherit",
  });

  let exitCode = result.status ?? 1;
  const gateStatusPath = path.join(runDir, "outputs", "human_gate", "status.json");
  const isPaused = fs.existsSync(gateStatusPath);
  if (isPaused) {
    try {
      const parsed = JSON.parse(fs.readFileSync(gateStatusPath, "utf8"));
      if (parsed?.status === "blocked") {
        exitCode = 2;
      }
    } catch {
      // best effort
    }
  }

  if (exitCode === 2) {
    console.error(`Run ${effectiveRunId} paused for human input.`);
    console.error(`Inspect notes: runs/${effectiveRunId}/outputs/human_gate/notes.md`);
    console.error(`Add override: runs/${effectiveRunId}/outputs/human_gate/override.json`);
    console.error(`Resume: make orchestrator-gated-resume RUN="${effectiveRunId}" DRY=0`);
  }
  process.exit(exitCode);
}

main();
