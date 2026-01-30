import http from "http";
import type { MCPRequest, MCPResponse } from "../protocol/messages";
import { PROTOCOL_VERSION } from "../protocol/messages";
import type { MCPServer } from "../server/createServer";
import { getConfiguredApiKey, isApiKeyAllowed } from "../auth/api_key";
import { TokenBucket } from "../server/rate_limit";

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

  // HTTP Protections configuration
  const maxBodyBytes = parseInt(process.env.AGENTX_MCP_MAX_BODY_BYTES ?? "1048576", 10); // 1MB default
  const timeoutMs = parseInt(process.env.AGENTX_MCP_TIMEOUT_MS ?? "30000", 10); // 30s default
  const rlPerMin = parseInt(process.env.AGENTX_MCP_RL_PER_MIN ?? "60", 10);
  const rlBurst = parseInt(process.env.AGENTX_MCP_RL_BURST ?? "20", 10);

  const rateLimiter = new TokenBucket(rlPerMin, rlBurst);

  const httpServer = http.createServer(async (req, res) => {
    const urlPath = req.url ? new URL(req.url, "http://localhost").pathname : "";

    // Only accept POST /mcp
    if (req.method !== "POST" || urlPath !== "/mcp") {
      res.statusCode = 404;
      res.end();
      return;
    }

    // Check API key first
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

    // Rate limiting check
    const rateLimitKey = providedKey ?? req.socket.remoteAddress ?? "unknown";
    if (!rateLimiter.tryConsume(rateLimitKey)) {
      writeJson(res, 429, { error: "Too Many Requests" });
      return;
    }

    // Body size check using Content-Length header
    const contentLength = req.headers["content-length"];
    if (contentLength && parseInt(contentLength, 10) > maxBodyBytes) {
      writeJson(res, 413, { error: "Request Entity Too Large" });
      return;
    }

    // Read body with size enforcement
    let raw: string;
    try {
      raw = await readBodyWithLimit(req, maxBodyBytes);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("too large")) {
        writeJson(res, 413, { error: "Request Entity Too Large" });
      } else {
        writeJson(res, 400, { error: "Failed to read body" });
      }
      return;
    }

    if (!raw) {
      writeJson(res, 400, { error: "Empty body" });
      return;
    }

    // Parse JSON
    let incoming: Partial<MCPRequest> = {};
    try {
      incoming = JSON.parse(raw);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid JSON";
      writeJson(res, 400, { error: message });
      return;
    }

    // Build request
    const request: MCPRequest = {
      ...(incoming as MCPRequest),
      protocol_version: incoming.protocol_version ?? PROTOCOL_VERSION,
    };

    // Execute request with timeout
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Request timeout")), timeoutMs);
      });

      const responsePromise = server.handleRequest(request);
      const response: MCPResponse = await Promise.race([responsePromise, timeoutPromise]);

      // Check for forbidden error
      if (!response.ok && response.error?.code === "FORBIDDEN") {
        writeJson(res, 403, {
          protocol_version: response.protocol_version,
          id: response.id,
          ok: false,
          error: response.error.message ?? "Forbidden",
        });
        return;
      }

      // Check for not found error
      if (!response.ok && response.error?.message?.includes("Unknown method")) {
        writeJson(res, 404, response);
        return;
      }

      // Normal response
      writeJson(res, response.ok ? 200 : 400, response);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      if (message.includes("timeout")) {
        writeJson(res, 504, { error: "Gateway Timeout" });
        return;
      }

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

function readBodyWithLimit(req: http.IncomingMessage, maxBytes: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalSize = 0;
    let settled = false;

    const cleanup = () => {
      req.off("data", onData);
      req.off("end", onEnd);
      req.off("error", onError);
      req.off("aborted", onAborted);
      req.off("close", onClose);
    };

    const settle = (fn: (value: any) => void, value: any) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      fn(value);
    };

    const onData = (chunk: Buffer | string) => {
      const buffer = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
      totalSize += buffer.length;

      if (totalSize > maxBytes) {
        req.destroy();
        settle(reject, new Error("Body too large"));
        return;
      }

      chunks.push(buffer);
    };

    const onEnd = () => settle(resolve, Buffer.concat(chunks).toString("utf8"));
    const onError = (err: unknown) => settle(reject, err);
    const onAborted = () => settle(reject, new Error("Request aborted"));

    // If the socket closes before "end", treat it as a read error.
    const onClose = () => {
      if (!settled) {
        settle(reject, new Error("Request closed"));
      }
    };

    req.on("data", onData);
    req.on("end", onEnd);
    req.on("error", onError);
    req.on("aborted", onAborted);
    req.on("close", onClose);
  });
}

function writeJson(res: http.ServerResponse, statusCode: number, payload: unknown) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}
