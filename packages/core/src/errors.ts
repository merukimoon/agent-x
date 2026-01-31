import process from "process";

export class CLIError extends Error {
    exitCode: number;
    showUsage: boolean;

    constructor(message: string, options: { exitCode?: number; showUsage?: boolean } = {}) {
        super(message);
        this.name = "CLIError";
        this.exitCode = options?.exitCode ?? 1;
        this.showUsage = options?.showUsage ?? false;
    }
}

/**
 * Raise a CLI error.
 */
export function fail(
    message: string,
    options?: {
        showUsage?: boolean;
        exitCode?: number;
    }
): never {
    throw new CLIError(message, options);
}

/**
 * Handle fatal errors consistently.
 */
export function handleFatalError(error: unknown, usage?: string): never {
    if (error instanceof CLIError) {
        console.error(`ERROR: ${error.message}`);
        if (error.showUsage && usage) {
            console.error(usage);
        }
        process.exit(error.exitCode);
    } else {
        console.error("ERROR: Unexpected failure.");
        if (error instanceof Error) {
            console.error(error.message);
        }
        process.exit(1);
    }
}
