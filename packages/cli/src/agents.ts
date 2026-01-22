import fs from "fs";
import path from "path";
import process from "process";
import { Core, Legacy } from "./imports.ts";

// Deconstruct from Legacy where helpful for cleaner code, or use Legacy.*
const {
  readFirstLines,
  readFileText,
  ensureRunAndInputs,
  buildNotes,
  writeJsonFile,
  writeFileAtomic,
} = Legacy;

const {
  PLAN_VERSION,
  isAgentName,
} = Core;


const { classifyFlow } = Legacy;

/**
 * @typedef {import("./imports.ts").Core.AgentName} AgentName
 * @typedef {import("./imports.ts").Core.AgentStatus} AgentStatus
 * @typedef {import("./imports.ts").Core.ExecutionMode} ExecutionMode
 * @typedef {import("./imports.ts").Core.RunId} RunId
 * @typedef {import("./imports.ts").Core.AgentResult} AgentResult
 * @typedef {import("./imports.ts").Core.PlanStep} PlanStep
 */

export const {
  getCanonicalOutputs,
  validateCanonicalOutputs
} = Core;

/**
 * Read dependency result status.
 * @param {AgentName} agent
 * @param {string} runDir
 * @returns {{ ok: boolean; message: string | null }}
 */
export function readDependencyStatus(agent, runDir) {
  const depResult = path.join(runDir, "outputs", agent, "result.json");
  if (!fs.existsSync(depResult) || !fs.statSync(depResult).isFile()) {
    return {
      ok: false,
      message: `Dependency result missing for ${agent}: ${depResult}`,
    };
  }
  try {
    const raw = fs.readFileSync(depResult, "utf8");
    const parsed = JSON.parse(raw);
    const status = parsed?.status;
    if (status !== "done") {
      return {
        ok: false,
        message: `Dependency ${agent} status is ${String(
          status
        )}, expected done.`,
      };
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { ok: false, message: `Dependency ${agent} parse failed: ${reason}` };
  }
  return { ok: true, message: null };
}

/**
 * Validate dependencies are satisfied.
 * @param {PlanStep} step
 * @param {string} runDir
 * @returns {{ ready: boolean; blocking: string | null }}
 */
export function checkDependenciesSatisfied(step, runDir) {
  for (const agent of step.depends_on) {
    const status = readDependencyStatus(agent, runDir);
    if (!status.ok) {
      return { ready: false, blocking: status.message ?? `Dependency ${agent} not ready.` };
    }
  }
  return { ready: true, blocking: null };
}

/**
 * Ensure dependencies are satisfied before running a step.
 * @param {PlanStep} step
 * @param {string} runDir
 */
export function ensureDependencies(step, runDir) {
  const depsStatus = checkDependenciesSatisfied(step, runDir);
  if (!depsStatus.ready) {
    throw new Error(`Dependencies not satisfied for ${step.id}: ${depsStatus.blocking ?? ""}`.trim());
  }
}

/**
 * Execute an agent, producing notes and result outputs.
 * Coordinator additionally writes plan.json.
 * @param {AgentName} agentName
 * @param {RunId} runId
 * @param {ExecutionMode} mode
 * @param {string | null} [contextOverridePath]
 * @returns {AgentResult}
 */
export function runAgent(agentName, runId, mode, contextOverridePath = null) {
  const runDir = path.join(process.cwd(), "runs", runId);
  ensureRunAndInputs(runDir);

  const requestPath = path.join(runDir, "inputs", "request.md");
  const contextPath = contextOverridePath ? path.resolve(contextOverridePath) : path.join(runDir, "inputs", "context.md");

  const requestExcerpt = readFirstLines(requestPath, 20);
  const contextExcerpt = readFirstLines(contextPath, 20);
  const createdAtUtc = new Date().toISOString();
  const summary = `${mode === "dry-run" ? "Dry run" : "Run"
    } completed for ${agentName} on run ${runId}.`;

  const outputsDir = path.join(runDir, "outputs", agentName);
  fs.mkdirSync(outputsDir, { recursive: true });

  const resultPath = path.join(outputsDir, "result.json");
  /** @type {AgentStatus} */
  const status = "done";
  /** @type {AgentResult} */
  const result = {
    agent: agentName,
    run_id: runId,
    status,
    created_at_utc: createdAtUtc,
    summary,
    mode,
  };
  writeJsonFile(resultPath, result);

  const notesPath = path.join(outputsDir, "notes.md");
  const notes = buildNotes({
    agentName,
    runId,
    createdAtUtc,
    mode,
    requestPath,
    contextPath,
    requestExcerpt,
    contextExcerpt,
  });
  writeFileAtomic(notesPath, notes);

  if (agentName === "coordinator") {
    const planPath = path.join(runDir, "plan.json");
    const requestText = readFileText(requestPath);
    const contextText = readFileText(contextPath);
    const classification = classifyFlow(requestText, contextText);
    /** @type {PlanStep[]} */
    const steps = [];
    const matchedSet = new Set(classification.signals.map((s) => s.replace(/^keyword:/, "")));
    classification.pack.steps.forEach((stepDef) => {
      if (
        Array.isArray(stepDef.enabled_if_keywords) &&
        stepDef.enabled_if_keywords.length > 0
      ) {
        const enabled = stepDef.enabled_if_keywords.some((k) =>
          matchedSet.has(k)
        );
        if (!enabled) {
          return;
        }
      }
      const priorOutputs = stepDef.depends_on.flatMap((dep) => {
        const outputs = getCanonicalOutputs(dep);
        return [outputs.result, outputs.notes];
      });
      steps.push({
        id: stepDef.id,
        agent: stepDef.agent,
        depends_on: stepDef.depends_on,
        inputs: {
          request: "inputs/request.md",
          context: "inputs/context.md",
          prior_outputs: priorOutputs,
        },
        outputs: getCanonicalOutputs(stepDef.agent),
        status: "pending",
        attempt: 0,
        max_attempts: 1,
        last_error: null,
        allow_skip: true,
      });
    });

    const rationaleSample = classification.signals.slice(0, 3).join(", ");
    const rationale =
      rationaleSample.length > 0
        ? `Selected ${classification.pack.flow_type} via keywords: ${rationaleSample}`
        : `Selected ${classification.pack.flow_type}.`;

    const plan = {
      run_id: runId,
      created_at_utc: createdAtUtc,
      version: PLAN_VERSION,
      flow_type: classification.pack.flow_type,
      rationale,
      signals: classification.signals,
      confidence: classification.confidence,
      steps,
    };
    writeJsonFile(planPath, plan);
  }

  const modeLabel = mode === "dry-run" ? "Dry run" : "Run";
  console.log(
    `${modeLabel} complete for agent "${agentName}" on run "${runId}". Outputs written to ${outputsDir}`
  );

  return result;
}
