/**
 * @agentsquad/cli
 * Public entrypoint for the CLI package.
 */

// Import the main CLI dispatch logic
import {
    handleStatusCommand,
    handleAgentCommand,
    handleFlowCommand,
    handleValidateCommand,
    handleRetryCommand,
    handleSkipCommand,
    handlePlannerCommand
} from "./cli.ts";
import { Legacy } from "./imports.ts";

/**
 * Main entry point for the CLI.
 * Dispatches to sub-commands.
 */
export async function runCli(args: string[]) {
    // args[0] is node, args[1] is script, args[2] is command
    const cliArgs = args.slice(2);

    if (cliArgs.length === 0) {
        console.error("Command is required."); // Or use fail() if we import it, but pure console is safer for top level
        process.exit(1);
    }

    const command = cliArgs[0];
    const rest = cliArgs.slice(1); // Not really used if we pass 'cliArgs' to handles which expect [command, ...args]? 
    // Wait, let's check handleAgentCommand signature from main.ts usage.
    // main.ts passed `args` which was `process.argv.slice(2) minus command`.
    // i.e. ["agent", "planner", "--run", "123"] -> main shifts "agent". passes ["planner", "--run", "123"].

    // existing handleAgentCommand(args) does:
    // args.shift() -> agentCandidate.
    // So it expects the agent name as first arg.

    // "args" passed to runCli is process.argv.
    // cliArgs = ["agent", "planner", ...]
    // we shift command "agent".
    // we pass ["planner", ...] to handleAgentCommand.

    const handlerArgs = cliArgs.slice(1);

    switch (command) {
        case "agent":
        case "planner": // aliases might need special handling if handler expects specific first arg
        case "architect":
            if (command === "agent") {
                handleAgentCommand(handlerArgs);
            } else {
                // If called as "planner", insert it back so handler sees it?
                // handleAgentCommand does `args.shift()`.
                // So if we run "node agentic.js planner ...", command="planner".
                // We call handleAgentCommand(["planner", ...])?
                // No, handleAgentCommand expects "planner" to be the agent name.
                // So yes, we pass [command, ...rest].
                handleAgentCommand([command, ...handlerArgs]);
            }
            break;
        case "status":
            handleStatusCommand(handlerArgs);
            break;
        case "flow":
            handleFlowCommand(handlerArgs);
            break;
        case "validate":
            handleValidateCommand(handlerArgs);
            break;
        case "retry":
            handleRetryCommand(handlerArgs);
            break;
        case "skip":
            handleSkipCommand(handlerArgs);
            break;
        default:
            console.log("Usage: node scripts/agentic.ts <command>");
            process.exit(1);
    }
}
