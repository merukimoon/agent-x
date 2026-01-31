/**
 * @agentsquad/cli
 * Public entrypoint for the CLI package.
 *
 * This file provides the stable external ADX CLI surface for the `agentic` binary.
 * It keeps legacy aliases working while exposing a structured command set with
 * help output and step-scoped execution flags.
 */

import fs from "fs";
import path from "path";
import process from "process";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import { ScaffoldService } from "./services/scaffold";
import { OrchestratorService } from "./services/orchestrator";
import {
  handleAgentCommand,
  handleFlowCommand,
  handleStatusCommand,
  handleValidateCommand,
  handleRetryCommand,
  handleSkipCommand,
  handleVerifyRunCommand,
  runFlow,
  verifyRun,
  parseRunArgs,
} from "./cli";
import { Legacy } from "./imports";
import { runAgent } from "./agents";
import { buildStatusView } from "./status_view";
import { renderStatusView } from "./status_render";
import type { AgentName } from "./imports";
const { runValidationChecks } = Legacy;

function resolveVersion() {
  const candidates = [
    path.resolve(process.cwd(), "package.json"),
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../package.json"),
  ];
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        const parsed = JSON.parse(fs.readFileSync(candidate, "utf8"));
        if (parsed?.version) return String(parsed.version);
      }
    } catch {
      // ignore
    }
  }
  return process.env.AGENTIC_VERSION || "0.0.0";
}
const VERSION = resolveVersion();
import { fail, handleFatalError, CLIError } from "../../core/src/errors.js";

type GlobalFlags = { json: boolean; quiet: boolean; help: boolean; version: boolean };

function parseGlobalFlags(args: string[]): { flags: GlobalFlags; rest: string[] } {
  const flags: GlobalFlags = { json: false, quiet: false, help: false, version: false };
  const rest: string[] = [];
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--json") {
      flags.json = true;
      continue;
    }
    if (arg === "--quiet") {
      flags.quiet = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      flags.help = true;
      continue;
    }
    if (arg === "--version" || arg === "-v") {
      flags.version = true;
      continue;
    }
    rest.push(arg);
  }
  return { flags, rest };
}

export function renderTopLevelHelp(): string {
  return [
    "ADX (agentic) — governed multi-agent runs and verification",
    "ADX is the CLI interface of AgentX, used by developers to run, plan, and verify AI-driven workflows via a deterministic API.",
    "",
    "Usage:",
    "  agentic <command> [options]",
    "",
    "Primary commands:",
    "  run new              Scaffold a run with goal/context",
    "  run show             Show run metadata and paths",
    "  run                  Execute a run (full or scoped)",
    "  plan                 Generate or refresh plan.json for a run",
    "  status               Show run status summary",
    "  step show            Show details for a specific step",
    "  step retry           Retry a failed step",
    "  step skip            Skip a step per policy",
    "  validate             Validate run artifacts and plan contracts",
    "  verify               Validate + verify-run (strict)",
    "  verify-run           Validate run artifacts (strict)",
    "  doctor               Check environment readiness",
    "",
    "Aliases:",
    "  flow                 Alias to run (executes plan)",
    "  agent                Direct agent invocation (legacy)",
    "  retry                Alias to step retry",
    "  skip                 Alias to step skip",
    "",
    "Step-scoped execution (with `agentic run --run <RUN>`):",
    "  --step <id>          Execute exactly one step",
    "  --from <id>          Execute unmet deps, the step, then downstream",
    "  --until <id>         Execute DAG up to the step then stop",
    "",
    "Global flags:",
    "  --help, -h           Show help",
    "  --version, -v        Show CLI version",
    "  --json               JSON output when supported",
    "  --quiet              Reduce human-readable output",
    "",
    "Exit codes:",
    "  0 success",
    "  1 user error (bad args, unknown step)",
    "  2 validation failure (contract/verify-run failure)",
    "  3 execution failure (runner or step failed)",
    "  4 environment failure (missing env/tool)",
    "",
    "Quickstart:",
    "  agentic run new --goal \"Summarize README\" --context README.md",
    "  agentic plan --run <RUN>",
    "  agentic run --run <RUN>",
  ].join("\n");
}

function renderRunHelp(): string {
  return [
    "agentic run — execute runs (full or scoped)",
    "",
    "Usage:",
    "  agentic run --run <RUN> [--dry-run] [--json]",
    "  agentic run --run <RUN> --step <STEP_ID> [--dry-run] [--json]",
    "  agentic run --run <RUN> --from <STEP_ID> [--dry-run] [--json]",
    "  agentic run --run <RUN> --until <STEP_ID> [--dry-run] [--json]",
    "",
    "Examples:",
    "  agentic run --run my-run",
    "  agentic run --run my-run --step planner",
    "  agentic run --run my-run --from step-2 --dry-run",
    "",
    "Exit codes:",
    "  0 success",
    "  1 user error (unknown step or bad args)",
    "  2 validation failure (verify-run failed)",
    "  3 execution failure (agent failed)",
  ].join("\n");
}

export function renderCommandHelp(command?: string): string {
  if (!command || command === "run") return renderRunHelp();
  if (command === "status") {
    return [
      "agentic status — show normalized run status",
      "Usage: agentic status --run <RUN> [--json]",
      "Examples:",
      "  agentic status --run my-run",
      "  agentic status --run my-run --json",
    ].join("\n");
  }
  if (command === "plan") {
    return [
      "agentic plan — generate or refresh plan.json using planner",
      "Usage: agentic plan --run <RUN> [--dry-run] [--json]",
      "Example:",
      "  agentic plan --run my-run",
      "Exit codes: 0 success, 1 user error, 3 execution failure",
    ].join("\n");
  }
  return renderTopLevelHelp();
}

function generateRunId() {
  const now = new Date();
  const utc = now.toISOString().replace(/[:.]/g, "-");
  return `run-${utc}`;
}

function scaffoldRun(params: { goal: string; contextPath: string; runId?: string; json?: boolean; printOnly?: boolean }) {
  const { goal, contextPath, json, printOnly } = params;
  const runId = params.runId || generateRunId();

  const contextContent = fs.existsSync(contextPath) ? fs.readFileSync(contextPath, "utf8") : contextPath;

  try {
    const createdRunDir = ScaffoldService.createRun({
      runId: runId,
      goal: goal,
      context: contextContent,
      log: (msg) => { if (!json && !printOnly) console.log(msg); }
    });

    if (json) {
      console.log(JSON.stringify({ run: runId, path: createdRunDir, goal, context: "inputs/context.md" }, null, 2));
    } else if (printOnly) {
      console.log(runId);
    } else {
      console.log(`Created run: ${runId}`);
      console.log(`  inputs/request.md`);
      console.log(`  inputs/context.md`);
      console.log(`  run.json`);
    }
    return runId;
  } catch (err: any) {
    fail(err.message, { exitCode: 1 });
    return "";
  }
}

function showRun(runId: string, json: boolean) {
  const runDir = path.join(process.cwd(), "runs", runId);
  if (!fs.existsSync(runDir)) {
    fail(`Run not found: ${runDir}`, { exitCode: 1 });
  }
  const result = {
    run: runId,
    path: runDir,
    plan: path.join(runDir, "plan.json"),
    runJson: path.join(runDir, "run.json"),
    summary: path.join(runDir, "summary", "final.md"),
    outputs: path.join(runDir, "outputs"),
  };
  if (json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`Run: ${runId}`);
    console.log(`  dir: ${result.path}`);
    console.log(`  plan: ${result.plan}`);
    console.log(`  run.json: ${result.runJson}`);
    console.log(`  summary: ${result.summary}`);
  }
}

async function runPlannerOnly(runId: string, dryRun: boolean, json: boolean) {
  const mode = dryRun ? "dry-run" : "live";
  await runAgent("planner" as AgentName, runId, mode);
  if (json) {
    console.log(JSON.stringify({ run: runId, mode, planner: "done" }, null, 2));
  }
}

async function executeRun(runId: string, scopeArgs: string[], dryRun: boolean, json: boolean) {
  const parsed = parseRunArgs(["--run", runId, ...scopeArgs]);
  const scope = parsed.stepId
    ? { kind: "single", stepId: parsed.stepId }
    : parsed.fromStepId
      ? { kind: "from", stepId: parsed.fromStepId }
      : parsed.untilStepId
        ? { kind: "until", stepId: parsed.untilStepId }
        : { kind: "full" };
  try {
    await runFlow(runId, dryRun ? "dry-run" : "live", scope as any);
  } catch (error) {
    if (error instanceof CLIError) {
      throw error;
    }
    throw new CLIError(error instanceof Error ? error.message : String(error), { exitCode: 3 });
  }
  if (!dryRun) {
    const result = verifyRun(path.join(process.cwd(), "runs", runId));
    if (!result.ok) {
      result.errors.forEach((e) => console.error(e));
      throw new CLIError("Validation failed", { exitCode: 2 });
    }
  }
  if (json) {
    console.log(
      JSON.stringify(
        {
          run: runId,
          scope: (scope as any).kind ?? "full",
          step: (scope as any).stepId ?? null,
          dryRun,
          validated: !dryRun,
        },
        null,
        2
      )
    );
  }
}

function showStep(runId: string, stepId: string, json: boolean) {
  const planPath = path.join(process.cwd(), "runs", runId, "plan.json");
  if (!fs.existsSync(planPath)) {
    fail(`plan.json not found at ${planPath}`, { exitCode: 1 });
  }
  const plan = JSON.parse(fs.readFileSync(planPath, "utf8"));
  const step = plan.steps.find((s: any) => s.id === stepId);
  if (!step) {
    fail(`Step not found: ${stepId}`, { exitCode: 1 });
  }
  const stepDir = path.join(process.cwd(), "runs", runId, "outputs", step.agent);
  const result = {
    id: step.id,
    agent: step.agent,
    status: step.status,
    depends_on: step.depends_on,
    outputs: step.outputs,
    artifacts_dir: stepDir,
  };
  if (json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`Step ${step.id} (${step.agent})`);
    console.log(`  status: ${step.status}`);
    console.log(`  depends_on: ${(step.depends_on || []).join(", ") || "-"}`);
    console.log(`  outputs: ${JSON.stringify(step.outputs)}`);
    console.log(`  artifacts: ${stepDir}`);
  }
}

function runDoctor(json: boolean) {
  const results = [];
  const nodeOk = typeof process.version === "string";
  results.push({ check: "node", ok: nodeOk, value: process.version });
  const pnpmVersion = (() => {
    const res = spawnSync("pnpm", ["--version"], { encoding: "utf8" });
    return res.status === 0 ? res.stdout.trim() : null;
  })();
  results.push({ check: "pnpm", ok: !!pnpmVersion, value: pnpmVersion });
  if (json) {
    console.log(JSON.stringify({ ok: results.every((r) => r.ok), results }, null, 2));
  } else {
    results.forEach((r) => console.log(`${r.ok ? "OK" : "FAIL"} ${r.check}${r.value ? ` (${r.value})` : ""}`));
  }
  if (!results.every((r) => r.ok)) {
    process.exit(4);
  }
}

/**
 * Main entry point for the CLI.
 */
export async function runCli(args: string[]) {
  const { flags, rest } = parseGlobalFlags(args.slice(2));
  const command = rest[0];
  if (flags.version) {
    console.log(VERSION);
    process.exit(0);
  }
  if (flags.help) {
    console.log(command ? renderCommandHelp(command) : renderTopLevelHelp());
    process.exit(0);
  }
  if (!command) {
    console.log(renderTopLevelHelp());
    process.exit(0);
  }
  const remainder = rest.slice(1);

  try {
    switch (command) {
      case "help":
        console.log(renderCommandHelp(remainder[0]));
        process.exit(0);
        break;
      case "run":
        if (remainder.length === 1 && (remainder[0] === "--help" || remainder[0] === "-h")) {
          console.log(renderCommandHelp("run"));
          process.exit(0);
        }
        if (remainder[0] === "new") {
          let goal = "";
          let context = "";
          let runId: string | undefined;
          let printRunOnly = false;
          for (let i = 1; i < remainder.length; i++) {
            const arg = remainder[i];
            if (arg === "--goal") {
              goal = remainder[++i] ?? "";
            } else if (arg === "--context") {
              context = remainder[++i] ?? "";
            } else if (arg === "--run") {
              runId = remainder[++i];
            } else if (arg === "--print-run") {
              printRunOnly = true;
            }
          }
          if (!goal) {
            fail("Goal is required (--goal)", { exitCode: 1 });
          }
          if (!context) {
            fail("Context is required (--context <path|string>)", { exitCode: 1 });
          }
          scaffoldRun({ goal, contextPath: context, runId, json: flags.json, printOnly: printRunOnly });
          break;
        }
        if (remainder[0] === "show") {
          const idx = remainder.findIndex((a) => a === "--run");
          const runId = idx !== -1 ? remainder[idx + 1] : null;
          if (!runId) {
            fail("RUN is required (--run <RUN>)", { exitCode: 1 });
          }
          showRun(runId, flags.json);
          break;
        }
        {
          const parsed = parseRunArgs(remainder);
          if (parsed.remainder.length > 0) {
            fail(`Unknown arguments: ${parsed.remainder.join(" ")}`, { exitCode: 1, showUsage: true });
          }
          await executeRun(parsed.runId, remainder, parsed.dryRun, flags.json);
        }
        break;
      case "plan": {
        let runId = "";
        let dryRun = false;
        for (let i = 0; i < remainder.length; i++) {
          if (remainder[i] === "--run") {
            runId = remainder[++i] ?? "";
          } else if (remainder[i] === "--dry-run") {
            dryRun = true;
          }
        }
        if (!runId) fail("RUN is required (--run <RUN>)", { exitCode: 1 });
        await runPlannerOnly(runId, dryRun, flags.json);
        break;
      }
      case "status": {
        const parsed = parseRunArgs(remainder);
        const runId = parsed.runId;
        if (flags.json) {
          const runDir = path.join(process.cwd(), "runs", runId);
          const view = buildStatusView(runDir);
          console.log(JSON.stringify(view, null, 2));
        } else {
          handleStatusCommand(remainder);
        }
        break;
      }
      case "step":
        if (remainder[0] === "show") {
          const runIdx = remainder.findIndex((a) => a === "--run");
          const stepIdx = remainder.findIndex((a) => a === "--step");
          const runId = runIdx !== -1 ? remainder[runIdx + 1] : "";
          const stepId = stepIdx !== -1 ? remainder[stepIdx + 1] : "";
          if (!runId || !stepId) fail("RUN and STEP are required", { exitCode: 1 });
          showStep(runId, stepId, flags.json);
          break;
        }
        if (remainder[0] === "retry") {
          handleRetryCommand(remainder.slice(1));
          break;
        }
        if (remainder[0] === "skip") {
          handleSkipCommand(remainder.slice(1));
          break;
        }
        fail("Unknown step subcommand", { exitCode: 1 });
        break;
      case "validate":
        handleValidateCommand(remainder);
        break;
      case "verify":
        if (flags.json) {
          const parsed = parseRunArgs(remainder);
          const runDir = path.join(process.cwd(), "runs", parsed.runId);
          const planPath = path.join(runDir, "plan.json");
          const validation = runValidationChecks(parsed.runId, runDir, planPath);
          const validationErrors: string[] = [];
          if (validation.planLoadError) validationErrors.push(validation.planLoadError);
          validationErrors.push(...validation.schemaErrors);
          validationErrors.push(...validation.missingPaths);
          const verifyResult = verifyRun(runDir);
          const ok = validationErrors.length === 0 && verifyResult.ok;
          console.log(
            JSON.stringify(
              {
                run: parsed.runId,
                validation: { ok: validationErrors.length === 0, errors: validationErrors },
                verify: { ok: verifyResult.ok, errors: verifyResult.errors },
              },
              null,
              2
            )
          );
          if (!ok) process.exit(2);
        } else {
          handleValidateCommand(remainder);
          handleVerifyRunCommand(remainder);
        }
        break;
      case "verify-run":
        handleVerifyRunCommand(remainder);
        break;
      case "agent":
        await handleAgentCommand(remainder);
        break;
      case "planner":
      case "architect":
        await handleAgentCommand([command, ...remainder]);
        break;
      case "flow":
        await handleFlowCommand(remainder);
        break;
      case "retry":
        handleRetryCommand(remainder);
        break;
      case "skip":
        handleSkipCommand(remainder);
        break;
      case "doctor":
        runDoctor(flags.json);
        break;
      default:
        fail(`Unknown command: ${command}`, { exitCode: 1, showUsage: true });
    }
  } catch (error) {
    handleFatalError(error, renderTopLevelHelp());
  }
}


export { OrchestratorService };
