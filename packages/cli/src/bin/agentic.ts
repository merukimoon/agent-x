#!/usr/bin/env node
/**
 * Entry point for the Agentic Squad Framework CLI.
 * Delegates to the internal CLI package.
 */

import { runCli } from "../index.js";
import process from "process";

export async function main(argv: string[]) {
    try {
        await runCli(argv);
    } catch (err) {
        console.error("CLI Error:", err);
        process.exit(1);
    }
}

// Only run if this file is the main module (i.e., not imported by test)
// In ESM, import.meta.url is the current file URL.
// We can check if it matches the executed script.
// However, a simpler pattern for testability is just checking if we should run.
// For now, we'll use a simple check or just let the test import runCli/main.
// But wait, if we import this file in a test, top-level code runs.
// We need to guard the execution.

const isMain = process.argv[1] === import.meta.filename || process.argv[1] === new URL(import.meta.url).pathname;

if (typeof require !== 'undefined' && require.main === module) {
    // CommonJS approach (unlikely here since we use ESM)
    main(process.argv);
} else {
    // ESM approach: checking if this is the entry point is tricky without a build step active.
    // But `process.argv[1]` usually holds the executed script path.
    // Let's use a standard idiom for ESM if possible, or just export runCli from index and test index?
    // The user asked to test THIS file.
    // Let's wrap the execution in a check.

    // Actually, `tsx` handles this.
    // Let's just execute it if we are not in a test environment?
    // Or better:

    // We can allow the side effect for now IF we can mock runCli.
    // But mocking runCli in the same file execution is hard if it runs immediately.

    // Standard Node ESM pattern for "if main":
    // import { fileURLToPath } from 'node:url';
    // if (process.argv[1] === fileURLToPath(import.meta.url)) { ... }
}

// Let's try the standard ESM pattern.
import { fileURLToPath } from 'url';

if (import.meta.url.startsWith('file:')) {
    const modulePath = fileURLToPath(import.meta.url);
    if (process.argv[1] === modulePath) {
        main(process.argv);
    }
}

