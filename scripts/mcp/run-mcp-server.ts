import process from "process";
import { createServer, startHttpServer, PROTOCOL_VERSION } from "../../packages/mcp/src/index";
import { runTechnicalWriter } from "../../packages/cli/src/runners.ts";

const server = createServer();
server.registerMethod("runner.technical-writer", (payload) => {
  const params = (payload ?? {}) as Parameters<typeof runTechnicalWriter>[0];
  if (!params || typeof params !== "object") {
    throw new Error("Invalid payload for runner.technical-writer");
  }
  return runTechnicalWriter(params);
});

const port = process.env.MCP_PORT ? Number(process.env.MCP_PORT) : 7801;
const host = process.env.MCP_HOST || "0.0.0.0";

startHttpServer(server, { port, host });
console.log(`MCP server ready on http://${host}:${port}/mcp (protocol ${PROTOCOL_VERSION})`);
