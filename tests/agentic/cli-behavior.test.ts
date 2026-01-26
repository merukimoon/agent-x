// @ts-check

import fs from "fs";
import os from "os";
import path from "path";
import { mkdtempSync } from "fs";
import { describe, expect, it } from "vitest";
import { runCli, copyDir } from "./_utils.ts";

const REPO_ROOT = path.resolve(path.join(__dirname, "..", ".."));
const scriptsDir = path.join(REPO_ROOT, "scripts");
const packagesDir = path.join(REPO_ROOT, "packages");
const domainDir = path.join(REPO_ROOT, "domain");

function scaffoldSandbox() {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "agentic-cli-"));
  copyDir(scriptsDir, path.join(tmp, "scripts"));
  copyDir(packagesDir, path.join(tmp, "packages"));
  copyDir(domainDir, path.join(tmp, "domain"));
  return tmp;
}

function makeValidRun(tmp, runId) {
  const runDir = path.join(tmp, "runs", runId);
  const now = new Date().toISOString();
  fs.mkdirSync(path.join(runDir, "inputs"), { recursive: true });
  fs.writeFileSync(path.join(runDir, "inputs", "request.md"), "request", "utf8");
  fs.writeFileSync(path.join(runDir, "inputs", "context.md"), "context", "utf8");

  const outputs = [
    { agent: "coordinator", id: "coordinator", depends: [] },
    { agent: "decision-maker", id: "step-1", depends: ["coordinator"] },
    { agent: "pr-reviewer", id: "step-2", depends: ["step-1"] },
  ];
  outputs.forEach(({ agent }) => {
    const dir = path.join(runDir, "outputs", agent);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "result.json"), JSON.stringify({ ok: true, agent }, null, 2));
    fs.writeFileSync(path.join(dir, "notes.md"), `${agent} notes`);
    fs.writeFileSync(
      path.join(dir, "status.json"),
      JSON.stringify({ status: "done", finished_at_utc: now, agent }, null, 2)
    );
  });

  fs.mkdirSync(path.join(runDir, "summary"), { recursive: true });
  fs.writeFileSync(path.join(runDir, "summary", "final.md"), `Run: ${runId}\nFlow: demo\nStatus: done\n`, "utf8");

  const plan = {
    run_id: runId,
    created_at_utc: now,
    version: "0.1",
    flow_type: "demo",
    rationale: "demo",
    signals: [],
    confidence: "low",
    steps: outputs.map(({ agent, id, depends }) => ({
      id,
      agent,
      depends_on: depends,
      inputs: { request: "inputs/request.md", context: "inputs/context.md", prior_outputs: [] },
      outputs: { result: `outputs/${agent}/result.json`, notes: `outputs/${agent}/notes.md` },
      status: "done",
      attempt: 0,
      max_attempts: 1,
      last_error: null,
      allow_skip: true,
    })),
  };
  fs.writeFileSync(path.join(runDir, "plan.json"), JSON.stringify(plan, null, 2), "utf8");
  fs.writeFileSync(
    path.join(runDir, "run.json"),
    JSON.stringify(
      { id: runId, run_id: runId, flow: "demo", status: "done", started_at_utc: now, finished_at_utc: now, exit_code: 0 },
      null,
      2
    ),
    "utf8"
  );
  const stepsDir = path.join(runDir, "steps");
  fs.mkdirSync(stepsDir, { recursive: true });
  const index = {
    schema_version: "steps-index.v1",
    run_id: runId,
    updated_at: now,
    steps: outputs.map(({ id, agent }, idx) => ({
      step_id: id,
      step_index: idx,
      agent_name: agent,
      status: "ok",
      decision_action: "continue",
    })),
  };
  fs.writeFileSync(path.join(stepsDir, "index.json"), JSON.stringify(index, null, 2));
  outputs.forEach(({ id }) => {
    const dir = path.join(stepsDir, id);
    fs.mkdirSync(dir, { recursive: true });
    ["decision_after_step.json", "effective_decision.json", "step_result.json"].forEach((fname) => {
      fs.writeFileSync(path.join(dir, fname), JSON.stringify({}, null, 2));
    });
  });
  return { runDir };
}

function makeExecutionFailureRun() {
  const tmp = scaffoldSandbox();
  const runId = "fail-run";
  const runDir = path.join(tmp, "runs", runId);
  fs.mkdirSync(path.join(runDir, "inputs"), { recursive: true });
  fs.writeFileSync(path.join(runDir, "inputs", "request.md"), "req", "utf8");
  fs.writeFileSync(path.join(runDir, "inputs", "context.md"), "ctx", "utf8");
  const now = new Date().toISOString();
  fs.writeFileSync(
    path.join(runDir, "run.json"),
    JSON.stringify({ id: runId, run_id: runId, status: "pending", flow: "demo", started_at_utc: now }, null, 2),
    "utf8"
  );
  const plan = {
    run_id: runId,
    created_at_utc: now,
    version: "0.1",
    flow_type: "test",
    rationale: "test",
    signals: [],
    confidence: "low",
    steps: [
      {
        id: "step-a",
        agent: "technical-writer",
        depends_on: [],
        inputs: { request: "inputs/request.md", context: "inputs/context.md", prior_outputs: [] },
        outputs: { result: "outputs/technical-writer/result.json", notes: "outputs/technical-writer/notes.md" },
        status: "pending",
        attempt: 0,
        max_attempts: 1,
        last_error: null,
        allow_skip: true,
      },
    ],
  };
  fs.writeFileSync(path.join(runDir, "plan.json"), JSON.stringify(plan, null, 2), "utf8");
  const outputsDir = path.join(runDir, "outputs");
  fs.mkdirSync(outputsDir, { recursive: true });
  fs.writeFileSync(path.join(outputsDir, "technical-writer"), "block mkdir", "utf8");
  const coordDir = path.join(outputsDir, "coordinator");
  fs.mkdirSync(coordDir, { recursive: true });
  fs.writeFileSync(path.join(coordDir, "result.json"), "{}");
  fs.writeFileSync(path.join(coordDir, "notes.md"), "coord");
  return { tmp, runId };
}

describe("CLI help snapshots", () => {
  it("agentic --help includes description, commands, examples, exit codes", () => {
    const result = runCli({ cwd: REPO_ROOT, args: ["scripts/agentic.ts", "--help"], useTsx: true });
    expect(result.code).toBe(0);
    const out = result.stdout || result.stderr;
    expect(out).toContain("AgentX CLI");
    expect(out).toContain("Primary commands");
    expect(out).toContain("Quickstart");
    expect(out).toContain("Exit codes");
  });

  it("agentic run --help includes usage and exit codes", () => {
    const result = runCli({ cwd: REPO_ROOT, args: ["scripts/agentic.ts", "run", "--help"], useTsx: true });
    expect(result.code).toBe(0);
    const out = result.stdout || result.stderr;
    expect(out).toContain("agentic run");
    expect(out).toContain("Usage:");
    expect(out).toContain("Exit codes");
  });
});

describe("Exit code normalization", () => {
  it("unknown step id exits 1", () => {
    const tmp = scaffoldSandbox();
    const runId = "valid-run";
    makeValidRun(tmp, runId);
    const result = runCli({
      cwd: tmp,
      args: ["scripts/agentic.ts", "run", "--run", runId, "--step", "nope", "--dry-run"],
      useTsx: true,
    });
    expect(result.code).toBe(1);
  });

  it("verify failure exits 2", () => {
    const tmp = scaffoldSandbox();
    const runId = "verify-fail";
    const { runDir } = makeValidRun(tmp, runId);
    fs.unlinkSync(path.join(runDir, "outputs", "pr-reviewer", "result.json"));
    const result = runCli({
      cwd: tmp,
      args: ["scripts/agentic.ts", "verify", "--run", runId],
      useTsx: true,
    });
    expect(result.code).toBe(2);
  });

  it("execution failure exits 3", () => {
    const { tmp, runId } = makeExecutionFailureRun();
    const result = runCli({
      cwd: tmp,
      args: ["scripts/agentic.ts", "run", "--run", runId, "--step", "step-a"],
      useTsx: true,
    });
    expect(result.code).toBe(3);
  });
});

describe("JSON output stability", () => {
  it("status --json emits stable fields", () => {
    const tmp = scaffoldSandbox();
    const runId = "status-json";
    makeValidRun(tmp, runId);
    const result = runCli({
      cwd: tmp,
      args: ["scripts/agentic.ts", "status", "--run", runId, "--json"],
      useTsx: true,
    });
    expect(result.code).toBe(0);
    const parsed = JSON.parse(result.stdout || "{}");
    expect(parsed.run_id || parsed.run || parsed.runId).toBeTruthy();
    expect(parsed.steps || parsed.summary).toBeTruthy();
  });

  it("verify --json emits validation and verify sections", () => {
    const tmp = scaffoldSandbox();
    const runId = "verify-json";
    makeValidRun(tmp, runId);
    const result = runCli({
      cwd: tmp,
      args: ["scripts/agentic.ts", "verify", "--run", runId, "--json"],
      useTsx: true,
    });
    expect(result.code).toBe(0);
    const parsed = JSON.parse(result.stdout || "{}");
    expect(parsed.run).toBe(runId);
    expect(parsed.validation).toBeTruthy();
    expect(parsed.verify).toBeTruthy();
  });
});
