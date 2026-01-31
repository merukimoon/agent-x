/**
 * Core dependencies bridge.
 * Extracted to allow mocking in unit tests without circular dependencies or complex path mapping.
 */
export { readFirstLines, writeFileAtomic, writeJsonFile } from "../../core/src/index.js";
