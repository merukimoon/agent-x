import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

type StepName =
  | "status"
  | "planner"
  | "ciso"
  | "coordinator"
  | "decision-maker"
  | "pr-reviewer"
  | "all";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");

function npmCmd() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function fail(message: string): never {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

function runNpm(args: string[], runId: string, agentName?: string) {
  const cmd = npmCmd();
  const printable = `${cmd} ${args.join(" ")}`;
  console.log(`$ ${printable}`);

  const res = spawnSync(cmd, args, {
    cwd: repoRoot,
    env: process.env,
    stdio: "pipe",
    encoding: "utf8",
  });

  if (res.stdout) process.stdout.write(res.stdout);
  if (res.stderr) process.stderr.write(res.stderr);

  if (res.status !== 0) {
    const outDir = agentName
      ? path.join(repoRoot, "runs", runId, "outputs", agentName)
      : path.join(repoRoot, "runs", runId);
    console.error(`Command failed (exit=${res.status ?? 1}). Inspect: ${outDir}`);
    process.exit(res.status ?? 1);
  }
}

function parseArgs(argv: string[]) {
  let runId = "";
  let step: StepName = "all";

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--run") {
      runId = argv[i + 1] ?? "";
      i += 1;
      continue;
    }
    if (arg.startsWith("--run=")) {
      runId = arg.slice("--run=".length);
      continue;
    }
    if (arg === "--step") {
      step = (argv[i + 1] as StepName) ?? "all";
      i += 1;
      continue;
    }
    if (arg.startsWith("--step=")) {
      step = arg.slice("--step=".length) as StepName;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      console.log(
        [
          "Usage:",
          "  node --import tsx scripts/smoke/manual-verify-flow-npm.ts --run <RUN> [--step <name>]",
          "",
          "Steps:",
          "  status | planner | ciso | coordinator | decision-maker | pr-reviewer | all",
          "",
          "Example:",
          "  node --import tsx scripts/smoke/manual-verify-flow-npm.ts --run 2026-01-23_1234-manual --step all",
        ].join("\n")
      );
      process.exit(0);
    }
  }

  if (!runId) {
    fail("Missing --run <RUN>.");
  }

  return { runId, step };
}

function main() {
  const { runId, step } = parseArgs(process.argv.slice(2));

  const status = () => runNpm(["run", "dev", "--", "status", "--run", runId], runId);
  const planner = () => runNpm(["run", "dev", "--", "planner", "--run", runId], runId, "planner");
  const agent = (name: Exclude<StepName, "status" | "planner" | "all">) =>
    runNpm(["run", "dev", "--", "agent", name, "--run", runId, "--dry-run"], runId, name);

  if (step === "status") return status();
  if (step === "planner") return planner();
  if (step === "ciso") return agent("ciso");
  if (step === "coordinator") return agent("coordinator");
  if (step === "decision-maker") return agent("decision-maker");
  if (step === "pr-reviewer") return agent("pr-reviewer");

  planner();
  status();
  agent("ciso");
  agent("coordinator");
  runNpm(["run", "dev", "--", "flow", "--run", runId, "--dry-run"], runId);
  status();
}

main();

