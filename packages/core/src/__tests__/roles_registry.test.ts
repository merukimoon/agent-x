import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadRolesRegistry } from "../../../../scripts/agentic/roles_registry";
import { gatherPlanSchemaErrors } from "../../../../scripts/agentic/plan";
import { runTechnicalWriter } from "../../../../scripts/agentic/runners";
import { PLAN_VERSION } from "../../../../scripts/agentic/core";

const ORIGINAL_CWD = process.cwd();

function scaffoldRole(root: string, role: string) {
  const dir = path.join(root, "domain", "roles", role);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "README.md"), `# ${role}\n`, "utf8");
}

function writeRegistry(root: string, entries: unknown[]) {
  const regDir = path.join(root, "domain", "roles");
  fs.mkdirSync(regDir, { recursive: true });
  fs.writeFileSync(
    path.join(regDir, "registry.json"),
    JSON.stringify(entries, null, 2),
    "utf8"
  );
}

describe("roles registry", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "roles-reg-"));
    vi.spyOn(process, "cwd").mockReturnValue(tempDir);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("rejects unknown agent ids", () => {
    writeRegistry(tempDir, [
      { id: "ghost", runner: "rule", blocking: true, required_artifacts: ["outputs/ghost/result.json", "outputs/ghost/notes.md", "outputs/ghost/status.json"] },
    ]);
    expect(() => loadRolesRegistry()).toThrow(/unknown or unsupported role id/i);
  });

  it("fails when README is missing", () => {
    fs.mkdirSync(path.join(tempDir, "domain", "roles", "planner"), { recursive: true });
    writeRegistry(tempDir, [
      { id: "planner", runner: "llm", blocking: true, required_artifacts: ["outputs/planner/result.json", "outputs/planner/notes.md", "outputs/planner/status.json"] },
    ]);
    expect(() => loadRolesRegistry()).toThrow(/missing domain\/roles\/planner\/README.md/i);
  });

  it("fails on invalid runner type", () => {
    scaffoldRole(tempDir, "planner");
    writeRegistry(tempDir, [
      { id: "planner", runner: "bad-runner", blocking: true, required_artifacts: ["outputs/planner/result.json", "outputs/planner/notes.md", "outputs/planner/status.json"] },
    ]);
    expect(() => loadRolesRegistry()).toThrow(/invalid runner type/i);
  });

  it("rejects plan steps for agents not in registry", () => {
    scaffoldRole(tempDir, "planner");
    scaffoldRole(tempDir, "technical-writer");
    writeRegistry(tempDir, [
      { id: "planner", runner: "llm", blocking: true, required_artifacts: ["outputs/planner/result.json", "outputs/planner/notes.md", "outputs/planner/status.json"] },
    ]);
    const plan = {
      run_id: "run-1",
      created_at_utc: new Date().toISOString(),
      version: PLAN_VERSION,
      flow_type: "test-flow",
      rationale: "test",
      signals: [],
      confidence: "low",
      steps: [
        {
          id: "step-0",
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
    const result = gatherPlanSchemaErrors(plan, "run-1");
    expect(result.schemaErrors.some((e) => e.includes("not executable per registry"))).toBe(true);
  });

  it("runs technical-writer runner and writes artifacts", () => {
    const runDir = path.join(tempDir, "runs", "run-tech");
    const inputsDir = path.join(runDir, "inputs");
    fs.mkdirSync(inputsDir, { recursive: true });
    const requestPath = path.join(inputsDir, "request.md");
    const contextPath = path.join(inputsDir, "context.md");
    fs.writeFileSync(requestPath, "Doc request\nLine2", "utf8");
    fs.writeFileSync(contextPath, "Context info", "utf8");
    const outputsDir = path.join(runDir, "outputs", "technical-writer");
    const result = runTechnicalWriter({
      runId: "run-tech",
      outputsDir,
      requestPath,
      contextPath,
      mode: "live",
    });
    expect(result.status).toBe("done");
    expect(fs.existsSync(path.join(outputsDir, "result.json"))).toBe(true);
    expect(fs.existsSync(path.join(outputsDir, "notes.md"))).toBe(true);
    expect(fs.existsSync(path.join(outputsDir, "status.json"))).toBe(true);
  });
});
