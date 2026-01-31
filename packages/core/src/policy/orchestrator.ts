
export enum OrchestratorExitCode {
    SUCCESS = 0,
    RETRYABLE_NETWORK = 10,
    FATAL_PARSE = 11,
    FATAL_SAFETY = 12,
    UNKNOWN_ERROR = 1
}

export interface PolicyDecision {
    action: 'retry' | 'fail' | 'success';
    reason: string;
    backoffMs?: number;
}

export class OrchestratorPolicy {
    static readonly MAX_RETRIES = 2;
    static readonly BACKOFF_MS = 2000;

    static evaluateExitCode(code: number, attempt: number): PolicyDecision {
        if (code === OrchestratorExitCode.SUCCESS) {
            return { action: 'success', reason: 'Process completed successfully.' };
        }

        if (code === OrchestratorExitCode.RETRYABLE_NETWORK) {
            if (attempt <= this.MAX_RETRIES) {
                return {
                    action: 'retry',
                    reason: 'Retryable network/internal error.',
                    backoffMs: this.BACKOFF_MS
                };
            }
            return { action: 'fail', reason: 'Max retries exhausted for network error.' };
        }

        if (code === OrchestratorExitCode.FATAL_PARSE) {
            return { action: 'fail', reason: 'Fatal parse/schema error. Do not retry.' };
        }

        if (code === OrchestratorExitCode.FATAL_SAFETY) {
            return { action: 'fail', reason: 'Safety violation. Do not retry.' };
        }

        return { action: 'fail', reason: `Unknown exit code: ${code}` };
    }
}
