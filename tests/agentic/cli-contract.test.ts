import { describe, expect, it } from "vitest";
import { renderTopLevelHelp, renderCommandHelp } from "../../packages/cli/src/index";

describe("CLI contract help", () => {
  it("renders top-level help with command groups and exit codes", () => {
    const help = renderTopLevelHelp();
    expect(help).toContain("agentic run new");
    expect(help).toContain("Exit codes:");
    expect(help).toContain("doctor");
  });

  it("renders run command help with scoped execution flags", () => {
    const help = renderCommandHelp("run");
    expect(help).toContain("--step");
    expect(help).toContain("--from");
    expect(help).toContain("--until");
    expect(help).toContain("Exit codes");
  });

  it("renders status help when requested", () => {
    const help = renderCommandHelp("status");
    expect(help).toContain("agentic status");
    expect(help).toContain("--json");
  });
});
