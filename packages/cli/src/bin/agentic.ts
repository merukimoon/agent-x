#!/usr/bin/env node
/**
 * Entry point for the Agentic Squad Framework CLI.
 * Delegates to the internal CLI package.
 */

import { runCli } from "../index.js";
import process from "process";

// Pass arguments to the CLI handler
// argv[0] is node, argv[1] is script path, argv[2+] are args
runCli(process.argv).catch((err) => {
    console.error("CLI Error:", err);
    process.exit(1);
});
