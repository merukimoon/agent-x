import fs from "fs";
import os from "os";
import path from "path";
import { describe, expect, it } from "vitest";
import { updateRunMetadata } from "../cli";

function readRun(runPath: string) {
  return JSON.parse(fs.readFileSync(runPath, "utf8"));
}

describe("updateRunMetadata", () => {
  it("marks a run as done with finished_at_utc and flow", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "run-meta-"));
    const runDir = path.join(tmp, "runs", "demo");
    fs.mkdirSync(runDir, { recursive: true });
    const runPath = path.join(runDir, "run.json");
    fs.writeFileSync(
      runPath,
      JSON.stringify(
        {
          id: "demo",
          created_at: "2026-01-23T00:00:00Z",
          slug: "demo",
          flow: "",
          status: "in_progress",
        },
        null,
        2
      ) + "\n",
      "utf8"
    );

    updateRunMetadata(runDir, {
      status: "done",
      finished_at_utc: "2026-01-23T01:00:00Z",
      flow: "pr-completion",
      exit_code: 0,
      error: null,
    });

    const next = readRun(runPath);
    expect(next.status).toBe("done");
    expect(next.finished_at_utc).toBe("2026-01-23T01:00:00Z");
    expect(next.flow).toBe("pr-completion");
    expect(next.exit_code).toBe(0);
  });

  it("marks a run as failed with error", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "run-meta-"));
    const runDir = path.join(tmp, "runs", "demo");
    fs.mkdirSync(runDir, { recursive: true });
    const runPath = path.join(runDir, "run.json");
    fs.writeFileSync(
      runPath,
      JSON.stringify({ id: "demo", created_at: "2026-01-23T00:00:00Z", slug: "demo" }, null, 2) + "\n",
      "utf8"
    );

    updateRunMetadata(runDir, {
      status: "failed",
      finished_at_utc: "2026-01-23T02:00:00Z",
      flow: "pr-completion",
      exit_code: 12,
      error: "Validation failed",
    });

    const next = readRun(runPath);
    expect(next.status).toBe("failed");
    expect(next.finished_at_utc).toBe("2026-01-23T02:00:00Z");
    expect(next.flow).toBe("pr-completion");
    expect(next.exit_code).toBe(12);
    expect(next.error).toBe("Validation failed");
  });
});
