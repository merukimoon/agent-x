import http from "http";
import type { MCPRequest, MCPResponse } from "../protocol/messages";
import { PROTOCOL_VERSION } from "../protocol/messages";
import type { MCPServer } from "../server/createServer";
import { getConfiguredApiKey, isApiKeyAllowed } from "../auth/api_key";

export interface HttpTransportOptions {
  port?: number;
  host?: string;
  apiKey?: string;
  logger?: Pick<Console, "log" | "error" | "warn">;
}

export function startHttpServer(server: MCPServer, options: HttpTransportOptions = {}) {
  const logger = options.logger ?? console;
  const expectedKey = options.apiKey ?? getConfiguredApiKey();
  const apiKeyMissing = !expectedKey;
  if (apiKeyMissing) {
    logger.error("AGENTX_MCP_API_KEY is not set; HTTP MCP server will reject all requests with 401.");
  }

  const httpServer = http.createServer(async (req, res) => {
    const urlPath = req.url ? new URL(req.url, "http://localhost").pathname : "";
    if (req.method !== "POST" || urlPath !== "/mcp") {
      res.statusCode = 404;
      res.end();
      return;
    }

    if (apiKeyMissing) {
      writeJson(res, 401, { error: "Missing AGENTX_MCP_API_KEY" });
      return;
    }

    const providedKeyHeader = req.headers["x-agentx-api-key"];
    const providedKey = Array.isArray(providedKeyHeader) ? providedKeyHeader[0] : providedKeyHeader;
    if (!isApiKeyAllowed(providedKey, expectedKey!)) {
      writeJson(res, 401, { error: "Unauthorized" });
      return;
    }

    const raw = await readBody(req);
    if (!raw) {
      writeJson(res, 400, { error: "Empty body" });
      return;
    }

    let incoming: Partial<MCPRequest> = {};
    try {
      incoming = JSON.parse(raw);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid JSON";
      writeJson(res, 400, { error: message });
      return;
    }

    const request: MCPRequest = {
      ...(incoming as MCPRequest),
      protocol_version: incoming.protocol_version ?? PROTOCOL_VERSION,
    };

    try {
      const response: MCPResponse = server.handleRequest(request);
      writeJson(res, response.ok ? 200 : 400, response);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const fallback: MCPResponse = {
        protocol_version: PROTOCOL_VERSION,
        id: request.id ?? "unknown",
        ok: false,
        error: { message },
      };
      writeJson(res, 500, fallback);
    }
  });

  const port = options.port ?? 7801;
  const host = options.host ?? "0.0.0.0";
  httpServer.listen(port, host, () => {
    const addr = httpServer.address();
    const finalPort = typeof addr === "object" && addr ? addr.port : port;
    logger.log(`MCP HTTP server listening on http://${host}:${finalPort}/mcp`);
  });
  return httpServer;
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", (err) => reject(err));
  });
}

function writeJson(res: http.ServerResponse, statusCode: number, payload: unknown) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}
