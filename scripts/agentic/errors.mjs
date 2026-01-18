// @ts-check

import process from "process";

export class CLIError extends Error {
  /**
   * @param {string} message
   * @param {{ exitCode?: number; showUsage?: boolean }} [options]
   */
  constructor(message, options) {
    super(message);
    this.name = "CLIError";
    this.exitCode = options?.exitCode ?? 2;
    this.showUsage = options?.showUsage ?? false;
  }
}

/**
 * Raise a CLI error.
 * @param {string} message
 * @param {{ showUsage?: boolean; exitCode?: number }} [options]
 * @returns {never}
 */
export function fail(message, options) {
  throw new CLIError(message, options);
}

/**
 * Handle fatal errors consistently.
 * @param {unknown} error
 * @param {string} [usage]
 * @returns {never}
 */
export function handleFatalError(error, usage) {
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
