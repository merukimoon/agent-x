#!/usr/bin/env node
// @ts-check

import fs from "fs";
import path from "path";
import process from "process";

/**
 * @typedef {"coordinator" | "decision-maker" | "pr-reviewer" | "ciso"} AgentName
 */
/**
 * @typedef {"blocked" | "in_progress" | "done" | "failed"} AgentStatus
 */
/**
 * @typedef {"dry-run" | "live"} ExecutionMode
 */
/**
 * @typedef {string} RunId
 */
/**
 * @typedef {{
 *   agent: AgentName;
 *   run_id: RunId;
 *   status: AgentStatus;
 *   created_at_utc: string;
 *   summary: string;
 *   mode: ExecutionMode;
 * }} AgentResult
 */
/**
 * @typedef {{
 *   agentName: AgentName;
 *   runId: RunId;
 *   createdAtUtc: string;
 *   mode: ExecutionMode;
 *   requestPath: string;
 *   contextPath: string;
 *   requestExcerpt: string[];
 *   contextExcerpt: string[];
 * }} BuildNotesParams
 */

/** @type {Set<AgentName>} */
const VALID_AGENTS = new Set([
  "coordinator",
  "decision-maker",
  "pr-reviewer",
  "ciso",
]);

const USAGE =
  "Usage: node scripts/agentic.mjs agent <agentName> --run <RUN_ID> [--dry-run]";

/**
 * Exit with an error message and non-zero status.
 * @param {string} message
 * @returns {never}
 */
function fail(message) {
  console.error(`ERROR: ${message}`);
  console.error(USAGE);
  process.exit(2);
}

/**
 * Determine whether a value is a supported agent name.
 * @param {string} value
 * @returns {value is AgentName}
 */
function isAgentName(value) {
  return VALID_AGENTS.has(/** @type {AgentName} */ (value));
}

/**
 * Read the first N lines from a file.
 * @param {string} filePath
 * @param {number} lineCount
 * @returns {string[]}
 */
function readFirstLines(filePath, lineCount) {
  try {
    const contents = fs.readFileSync(filePath, "utf8");
    const lines = contents.split(/\r?\n/);
    return lines.slice(0, lineCount);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    fail(`Unable to read file: ${filePath}. ${reason}`);
  }
}

/**
 * Format a labeled excerpt as Markdown.
 * @param {string} label
 * @param {string[]} lines
 * @returns {string}
 */
function formatExcerpt(label, lines) {
  const safeLines = lines.length > 0 ? lines : ["(file empty)"];
  const quoted = safeLines.map((line) => `> ${line}`);
  return [`## ${label} (first 20 lines)`, ...quoted, ""].join("\n");
}

/**
 * Build agent notes content.
 * @param {BuildNotesParams} params
 * @returns {string}
 */
function buildNotes({
  agentName,
  runId,
  createdAtUtc,
  mode,
  requestPath,
  contextPath,
  requestExcerpt,
  contextExcerpt,
}) {
  const modeDescription =
    mode === "dry-run" ? "dry-run (no external actions performed)" : mode;
  const summaryLines = [
    `- Agent: ${agentName}`,
    `- Run: ${runId}`,
    `- Mode: ${modeDescription}`,
    `- Created at (UTC): ${createdAtUtc}`,
    `- Inputs: ${requestPath}, ${contextPath}`,
  ];

  return [
    `# Agent: ${agentName}`,
    "",
    "Summary:",
    ...summaryLines,
    "",
    formatExcerpt("request.md", requestExcerpt),
    formatExcerpt("context.md", contextExcerpt),
  ].join("\n");
}

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    fail('Command is required. Example: "agent <agentName> --run <RUN_ID>".');
  }

  const command = args.shift();
  if (!command) {
    fail("Command parsing failed.");
  }

  if (["-h", "--help", "help"].includes(command)) {
    console.log(USAGE);
    process.exit(0);
  }

  if (command !== "agent") {
    fail(`Unsupported command: ${command}`);
  }

  if (args.length === 0 || (args[0]?.startsWith("-") ?? false)) {
    fail('Agent name is required as the first argument after "agent".');
  }

  const agentCandidate = args.shift();

  if (!agentCandidate) {
    fail("Agent name could not be read from arguments.");
  }

  if (!isAgentName(agentCandidate)) {
    fail(
      `Unknown agent "${agentCandidate}". Supported agents: ${Array.from(
        VALID_AGENTS
      ).join(", ")}`
    );
  }

  const agentName = agentCandidate;

  /** @type {RunId | null} */
  let runId = null;
  let dryRun = true; // Step 1: dry-run is the only supported mode.

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];

    if (arg === "--run") {
      const value = args[i + 1];
      if (!value || value.startsWith("--")) {
        fail("Value required for --run <RUN_ID>.");
      }
      runId = value;
      i += 1;
      continue;
    }

    if (arg.startsWith("--run=")) {
      runId = arg.slice("--run=".length);
      continue;
    }

    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }

    fail(`Unknown argument: ${arg}`);
  }

  if (!runId) {
    fail("RUN_ID is required via --run <RUN_ID>.");
  }

  const runDir = path.join(process.cwd(), "runs", runId);

  if (!fs.existsSync(runDir) || !fs.statSync(runDir).isDirectory()) {
    fail(`Run directory not found: ${runDir}`);
  }

  const requestPath = path.join(runDir, "inputs", "request.md");
  const contextPath = path.join(runDir, "inputs", "context.md");

  [requestPath, contextPath].forEach((filePath) => {
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      fail(`Input file not found: ${filePath}`);
    }
  });

  const requestExcerpt = readFirstLines(requestPath, 20);
  const contextExcerpt = readFirstLines(contextPath, 20);
  const createdAtUtc = new Date().toISOString();
  const mode = dryRun ? "dry-run" : "live";
  const summary = `${
    mode === "dry-run" ? "Dry run" : "Run"
  } completed for ${agentName} on run ${runId}.`;

  const outputsDir = path.join(runDir, "outputs", agentName);
  fs.mkdirSync(outputsDir, { recursive: true });

  const resultPath = path.join(outputsDir, "result.json");
  /** @type {AgentStatus} */
  const status = "done"; // Step 1: dry-run is the only supported mode.
  /** @type {AgentResult} */
  const result = {
    agent: agentName,
    run_id: runId,
    status,
    created_at_utc: createdAtUtc,
    summary,
    mode,
  };
  fs.writeFileSync(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");

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
  fs.writeFileSync(notesPath, notes, "utf8");

  console.log(`Dry run complete for agent "${agentName}" on run "${runId}".`);
  console.log(`Outputs written to ${outputsDir}`);
}

main();
