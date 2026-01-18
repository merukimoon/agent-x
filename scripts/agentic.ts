#!/usr/bin/env node

import { USAGE } from "./agentic/core.ts";
import { handleFatalError } from "./agentic/errors.ts";
import { main } from "./agentic/main.ts";

try {
  main(process.argv.slice(2));
} catch (error) {
  handleFatalError(error, USAGE);
}
