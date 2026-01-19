// @ts-check

import { USAGE } from "./core.ts";
import { fail } from "./errors.ts";
import {
  handleAgentCommand,
  handleFlowCommand,
  handleValidateCommand,
  handleRetryCommand,
  handleSkipCommand,
  handleStatusCommand,
  handlePlannerCommand,
} from "./cli.ts";

/**
 * @param {string[]} argv
 */
export function main(argv = process.argv.slice(2)) {
  const args = [...argv];

  if (args.length === 0) {
    fail("Command is required.", { showUsage: true });
  }

  const command = args.shift();
  if (!command) {
    fail("Command parsing failed.", { showUsage: true });
  }

  if (["-h", "--help", "help"].includes(command)) {
    console.log(USAGE);
    process.exit(0);
  }

  if (command === "agent") {
    handleAgentCommand(args);
    return;
  }

  if (command === "flow") {
    handleFlowCommand(args);
    return;
  }

  if (command === "validate") {
    handleValidateCommand(args);
    return;
  }

  if (command === "retry") {
    handleRetryCommand(args);
    return;
  }

  if (command === "skip") {
    handleSkipCommand(args);
    return;
  }

  if (command === "status") {
    handleStatusCommand(args);
    return;
  }

  if (command === "planner") {
    handlePlannerCommand(args);
    return;
  }

  fail(`Unsupported command: ${command}`, { showUsage: true });
}
