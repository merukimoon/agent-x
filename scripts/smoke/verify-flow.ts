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

function writeJson(filePath: string, data: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
}

function writeRunJsonFailure(runDir: string, runId: string, message: string, finishedAt: string, exitCode: number) {
  const runPath = path.join(runDir, "run.json");
  if (!fs.existsSync(runPath)) {
    return;
  }
  try {
    const data = JSON.parse(fs.readFileSync(runPath, "utf8"));
    if (!data.flow || typeof data.flow !== "string" || data.flow.trim().length === 0) {
      data.flow = "verify-flow";
    }
    data.status = "failed";
    data.last_error = { agent: "planner", message, at: finishedAt, exitCode };
    if (!Array.isArray(data.errors)) {
      data.errors = [];
    }
    data.errors.push({ agent: "planner", message, at: finishedAt, exitCode });
    writeJson(runPath, data);
  } catch {
    // best effort
  }
}

function runPlannerOrFail(runId: string, runDir: string) {
  const outputsDir = path.join(runDir, "outputs", "planner");
  fs.mkdirSync(outputsDir, { recursive: true });
  const statusPath = path.join(outputsDir, "status.json");
  const stderrPath = path.join(outputsDir, "stderr.txt");
  const resultPath = path.join(outputsDir, "result.json");
  const startedAt = new Date().toISOString();
  writeJson(statusPath, { status: "running", started_at: startedAt, agent: "planner", run_id: runId });

  try {
    const args = ["run", "dev", "--", "planner", "--run", runId];
    const res = spawnSync(process.execPath, ["--import", "tsx", path.join("scripts", "agentic.ts"), "planner", "--run", runId], {
      cwd: repoRoot,
      env: process.env,
      stdio: "pipe",
      encoding: "utf8",
    });
    if (res.stdout) {
      process.stdout.write(res.stdout);
    }
    if (res.status !== 0) {
      const finishedAt = new Date().toISOString();
      const exitCode = res.status ?? 1;
      const stderrText = res.stderr || "";
      const lines = stderrText.split(/\r?\n/);
      const tail = lines.slice(-200).join("\n");
      if (tail.trim().length > 0) {
        console.error(tail);
      }
      const stackPart = res.error?.stack ? `\n${res.error.stack}` : "";
      fs.writeFileSync(stderrPath, (tail || stderrText || "Planner failed") + stackPart, "utf8");
      const message =
        res.error?.message ||
        lines.find((l) => l.trim().length > 0) ||
        stderrText ||
        "Planner failed";
      writeJson(statusPath, {
        status: "failed",
        finished_at: finishedAt,
        exitCode,
        agent: "planner",
        run_id: runId,
        error: message,
        error_stack: res.error?.stack ?? null,
      });
      writeJson(resultPath, {
        agent: "planner",
        run_id: runId,
        status: "failed",
        created_at_utc: startedAt,
        summary: message,
        mode: "live",
        exitCode,
        error: message,
        error_stack: res.error?.stack ?? null,
      });
      writeRunJsonFailure(runDir, runId, message, finishedAt, exitCode);
      console.error(`Planner failed. Inspect outputs in ${path.join(runDir, "outputs", "planner")}`);
      process.exit(exitCode);
    }
    const finishedAt = new Date().toISOString();
    writeJson(statusPath, {
      status: "ok",
      finished_at: finishedAt,
      exitCode: 0,
      agent: "planner",
      run_id: runId,
    });
  } catch (err) {
    const finishedAt = new Date().toISOString();
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack ?? null : null;
    fs.writeFileSync(stderrPath, `${message}\n${stack ?? ""}`.trim() || message, "utf8");
    writeJson(statusPath, {
      status: "failed",
      finished_at: finishedAt,
      exitCode: 1,
      agent: "planner",
      run_id: runId,
      error: message,
      error_stack: stack,
    });
    writeJson(resultPath, {
      agent: "planner",
      run_id: runId,
      status: "failed",
      created_at_utc: startedAt,
      summary: message,
      mode: "live",
      exitCode: 1,
      error: message,
      error_stack: stack,
    });
    writeRunJsonFailure(runDir, runId, message, finishedAt, 1);
    console.error(`Planner failed. Inspect outputs in ${path.join(runDir, "outputs", "planner")}`);
    throw err;
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
