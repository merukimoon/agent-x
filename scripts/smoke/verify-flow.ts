import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");

function fail(message: string): never {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

function runCommand(cmd: string, args: string[], opts?: { inherit?: boolean; env?: NodeJS.ProcessEnv }) {
  const spawnOpts = {
    cwd: repoRoot,
    env: opts?.env ?? process.env,
    stdio: opts?.inherit ? "inherit" : "pipe",
    encoding: "utf8" as const,
  };
  const res = spawnSync(cmd, args, spawnOpts as any);
  if (opts?.inherit === false) {
    if (res.stdout) process.stdout.write(res.stdout);
    if (res.stderr) process.stderr.write(res.stderr);
  }
  if (res.status !== 0) {
    fail(`Command failed: ${cmd} ${args.join(" ")}`);
  }
  return res;
}

function runPlannerOrFail(runId: string, runDir: string) {
  const args = ["run", "dev", "--", "planner", "--run", runId];
  const res = spawnSync("npm", args, {
    cwd: repoRoot,
    env: process.env,
    stdio: "pipe",
    encoding: "utf8",
  });
  if (res.stdout) {
    process.stdout.write(res.stdout);
  }
  if (res.status !== 0) {
    if (res.stderr) {
      const lines = res.stderr.split(/\r?\n/);
      const tail = lines.slice(-200).join("\n");
      console.error(tail);
    }
    console.error(`Planner failed. Inspect outputs in ${path.join(runDir, "outputs", "planner")}`);
    process.exit(res.status ?? 1);
  }
}

function listRuns(): { name: string; mtime: number }[] {
  const runsDir = path.join(repoRoot, "runs");
  if (!fs.existsSync(runsDir)) {
    return [];
  }
  return fs
    .readdirSync(runsDir)
    .map((name) => {
      const full = path.join(runsDir, name);
      const stat = fs.statSync(full);
      return { name, mtime: stat.mtimeMs, isDir: stat.isDirectory() };
    })
    .filter((r) => r.isDir)
    .map((r) => ({ name: r.name, mtime: r.mtime }));
}

function scaffoldRun(): { runId: string; runDir: string } {
  const before = new Set(listRuns().map((r) => r.name));
  const name = `verify-flow-${Date.now()}`;
  runCommand(
    "node",
    ["--import", "tsx", path.join("scripts", "scaffold-run.ts")],
    { inherit: false, env: { ...process.env, NAME: name } }
  );

  const candidates = listRuns().filter((r) => !before.has(r.name));
  const chosen = candidates.length > 0
    ? candidates.reduce((a, b) => (b.mtime > a.mtime ? b : a))
    : listRuns().reduce((a, b) => (b.mtime > a.mtime ? b : a), { name: "", mtime: 0 });

  if (!chosen.name) {
    fail("Unable to locate scaffolded run directory.");
  }

  const runId = chosen.name;
  const runDir = path.join(repoRoot, "runs", runId);
  if (!fs.existsSync(runDir)) {
    fail(`Scaffolded run directory not found: ${runDir}`);
  }
  console.log(`Scaffolded run: ${runId}`);
  return { runId, runDir };
}

function writeInputs(runDir: string) {
  const inputsDir = path.join(runDir, "inputs");
  fs.mkdirSync(inputsDir, { recursive: true });
  fs.writeFileSync(
    path.join(inputsDir, "request.md"),
    "Product verification request: verify wiring.\n",
    "utf8"
  );
  fs.writeFileSync(
    path.join(inputsDir, "context.md"),
    "Context: verify-flow smoke to ensure CLI plumbing works.\n",
    "utf8"
  );
}

function ensureInputsPresent(runDir: string) {
  const requestPath = path.join(runDir, "inputs", "request.md");
  const contextPath = path.join(runDir, "inputs", "context.md");
  [requestPath, contextPath].forEach((p) => {
    if (!fs.existsSync(p)) {
      fail(`Input file missing: ${p}`);
    }
    const content = fs.readFileSync(p, "utf8");
    if (content.trim().length === 0) {
      fail(`Input file is empty: ${p}`);
    }
  });
  console.log(`Inputs ready:\n- ${requestPath}\n- ${contextPath}`);
}

function ensurePlannerOutputs(runDir: string) {
  const resultPath = path.join(runDir, "outputs", "planner", "result.json");
  const notesPath = path.join(runDir, "outputs", "planner", "notes.md");
  if (!fs.existsSync(resultPath)) {
    fail(`Planner result missing: ${resultPath}`);
  }
  if (!fs.existsSync(notesPath)) {
    fail(`Planner notes missing: ${notesPath}`);
  }
}

function listRun(runDir: string) {
  console.log("Run contents (depth 2):");
  const level1 = fs.readdirSync(runDir).sort();
  level1.forEach((entry) => {
    const full = path.join(runDir, entry);
    const prefix = path.relative(repoRoot, full);
    console.log(`- ${prefix}${fs.statSync(full).isDirectory() ? "/" : ""}`);
    if (fs.statSync(full).isDirectory()) {
      const level2 = fs.readdirSync(full).sort();
      level2.forEach((child) => {
        const childPath = path.join(full, child);
        console.log(`  - ${path.relative(repoRoot, childPath)}${fs.statSync(childPath).isDirectory() ? "/" : ""}`);
      });
    }
  });
}

function main() {
  const { runId, runDir } = scaffoldRun();
  writeInputs(runDir);
  ensureInputsPresent(runDir);

  runPlannerOrFail(runId, runDir);
  runCommand("npm", ["run", "dev", "--", "status", "--run", runId], { inherit: true });
  runCommand("npm", ["run", "dev", "--", "agent", "coordinator", "--run", runId, "--dry-run"], { inherit: true });
  runCommand("npm", ["run", "dev", "--", "flow", "--run", runId, "--dry-run"], { inherit: true });

  ensurePlannerOutputs(runDir);
  listRun(runDir);

  console.log(`verify-flow OK. RUN=${runId}`);
}

main();
