import fs from "fs";
import path from "path";

function parseArgs() {
  const args = process.argv.slice(2);
  let runId = "";
  let stepId = "human_gate";
  let action = "continue";
  let reason = "override applied";
  let actor = "operator";
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--run") runId = args[++i] || "";
    else if (arg === "--step") stepId = args[++i] || stepId;
    else if (arg === "--action") action = args[++i] || action;
    else if (arg === "--reason") reason = args[++i] || reason;
    else if (arg === "--actor") actor = args[++i] || actor;
  }
  if (!runId) {
    console.error("RUN is required (--run <id>)");
    process.exit(1);
  }
  return { runId, stepId, action, reason, actor };
}

function main() {
  const { runId, stepId, action, reason, actor } = parseArgs();
  const override = {
    schema_version: "step-override.v1",
    run_id: runId,
    step_id: stepId,
    actor: { type: "human", id: actor },
    override_action: action,
    routing_override: null,
    acknowledged_risks: [],
    reason,
  };
  const targetDir = path.join(process.cwd(), "runs", runId, "outputs", stepId);
  fs.mkdirSync(targetDir, { recursive: true });
  const targetPath = path.join(targetDir, "override.json");
  fs.writeFileSync(targetPath, JSON.stringify(override, null, 2) + "\n", "utf8");
  console.log(`override.json written to ${targetPath}`);
}

main();
