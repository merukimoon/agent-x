import type { MCPRequest, MCPResponse } from "../protocol/messages.ts";
import { PROTOCOL_VERSION } from "../protocol/messages.ts";
import type { MCPServer } from "../server/createServer.ts";

export interface InprocessTransport {
  send: (request: Omit<MCPRequest, "protocol_version"> & Partial<Pick<MCPRequest, "protocol_version">>) => MCPResponse;
}

export function createInprocessTransport(server: MCPServer): InprocessTransport {
  return {
    send(requestInput) {
      const request: MCPRequest = {
        ...requestInput,
        protocol_version: requestInput.protocol_version ?? PROTOCOL_VERSION,
      } as MCPRequest;
      return server.handleRequest(request);
    },
  };
}
