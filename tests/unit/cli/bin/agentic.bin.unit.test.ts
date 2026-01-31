
import { describe, it, expect, vi } from "vitest";
import { main } from "../../../../packages/cli/src/bin/agentic.ts";
import * as IndexModule from "../../../../packages/cli/src/index.ts";
import process from "process";

vi.mock("../../../../packages/cli/src/index.ts");
vi.spyOn(process, "exit").mockImplementation((() => { }) as any);
vi.spyOn(console, "error").mockImplementation(() => { });

describe("agentic bin", () => {
    it("calls runCli with provided arguments", async () => {
        const argv = ["node", "script", "arg1"];
        await main(argv);
        expect(IndexModule.runCli).toHaveBeenCalledWith(argv);
    });

    it("exits process on error", async () => {
        vi.mocked(IndexModule.runCli).mockRejectedValue(new Error("test error"));
        const argv = ["node", "script"];
        await main(argv);
        expect(process.exit).toHaveBeenCalledWith(1);
    });
});
