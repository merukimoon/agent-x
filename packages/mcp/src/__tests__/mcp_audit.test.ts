import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { createServer, createInprocessTransport } from "../index";

function cleanup(dir: string) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

describe("MCP audit logging", () => {
  it("appends an audit line when run directory exists", () => {
    const runId = `audit-${Date.now()}`;
    const runDir = path.join(process.cwd(), "runs", runId);
    fs.mkdirSync(runDir, { recursive: true });

    try {
      const server = createServer();
      server.registerMethod("demo", () => ({ ok: true }));
      const transport = createInprocessTransport(server);

      const response = transport.send({
        id: "audit-1",
        run_id: runId,
        from: "test",
        to: "demo",
        method: "demo",
      });

      expect(response.ok).toBe(true);

      const auditPath = path.join(runDir, "mcp", "audit.jsonl");
      expect(fs.existsSync(auditPath)).toBe(true);
      const lines = fs.readFileSync(auditPath, "utf8").trim().split("\n").filter(Boolean);
      expect(lines.length).toBe(1);
      const record = JSON.parse(lines[0]);
      expect(record.run_id).toBe(runId);
      expect(record.method).toBe("demo");
      expect(record.ok).toBe(true);
      expect(typeof record.duration_ms).toBe("number");
    } finally {
      cleanup(runDir);
    }
  });
});
