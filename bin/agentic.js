#!/usr/bin/env node
// Bootstrap the Agentic Squad Framework CLI.
import "tsx/esm";
import { runCli } from "../packages/cli/src/index.ts";
import process from "process";

runCli(process.argv).catch((err) => {
  console.error("CLI Error:", err);
  process.exit(1);
});
