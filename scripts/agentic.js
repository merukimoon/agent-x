#!/usr/bin/env node
// @ts-check

import { USAGE } from "./agentic/core.js";
import { handleFatalError } from "./agentic/errors.js";
import { main } from "./agentic/main.js";

try {
  main(process.argv.slice(2));
} catch (error) {
  handleFatalError(error, USAGE);
}
