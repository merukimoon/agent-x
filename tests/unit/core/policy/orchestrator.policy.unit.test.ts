
import { describe, it, expect } from "vitest";
import { OrchestratorExitCode, OrchestratorPolicy } from "../../../../packages/core/src/policy/orchestrator.ts";

describe("OrchestratorPolicy", () => {
    describe("evaluateExitCode", () => {
        it("returns success for exit code 0", () => {
            const decision = OrchestratorPolicy.evaluateExitCode(OrchestratorExitCode.SUCCESS, 1);
            expect(decision).toEqual({ action: "success", reason: "Process completed successfully." });
        });

        it("returns retry for network error (code 10) within limits", () => {
            const decision = OrchestratorPolicy.evaluateExitCode(OrchestratorExitCode.RETRYABLE_NETWORK, 1);
            expect(decision).toEqual({
                action: "retry",
                reason: "Retryable network/internal error.",
                backoffMs: OrchestratorPolicy.BACKOFF_MS
            });
        });

        it("returns fail for network error (code 10) exceeding max retries", () => {
            const decision = OrchestratorPolicy.evaluateExitCode(OrchestratorExitCode.RETRYABLE_NETWORK, OrchestratorPolicy.MAX_RETRIES + 1);
            expect(decision).toEqual({
                action: "fail",
                reason: "Max retries exhausted for network error."
            });
        });

        it("returns fail for fatal parse error (code 11)", () => {
            const decision = OrchestratorPolicy.evaluateExitCode(OrchestratorExitCode.FATAL_PARSE, 1);
            expect(decision.action).toBe("fail");
            expect(decision.reason).toContain("Fatal parse/schema error");
        });

        it("returns fail for safety violation (code 12)", () => {
            const decision = OrchestratorPolicy.evaluateExitCode(OrchestratorExitCode.FATAL_SAFETY, 1);
            expect(decision.action).toBe("fail");
            expect(decision.reason).toContain("Safety violation");
        });

        it("returns fail for unknown error codes", () => {
            const decision = OrchestratorPolicy.evaluateExitCode(99, 1);
            expect(decision.action).toBe("fail");
            expect(decision.reason).toContain("Unknown exit code: 99");
        });
    });
});
