// @ts-check

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "..");
const ignoreDirs = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "out",
  "coverage",
]);

/** @type {string[]} */
const errors = [];

/**
 * @param {string} entryPath
 */
function isIgnored(entryPath) {
  return entryPath.split(path.sep).some((part) => ignoreDirs.has(part));
}

/**
 * @param {string} filePath
 */
function checkFile(filePath) {
  const rel = path.relative(repoRoot, filePath);
  if (filePath.endsWith(".mjs")) {
    errors.push(`Found disallowed .mjs file: ${rel}`);
    return;
  }
  if (!filePath.endsWith(".js")) return;
  const content = fs.readFileSync(filePath, "utf8");
  const requirePattern = /\brequire\s*\(/;
  const moduleExportsPattern = /\bmodule\.exports\b/;
  const exportsPattern = /\bexports\./;
  if (requirePattern.test(content)) {
    errors.push(`Disallowed CommonJS require usage in ${rel}`);
  }
  if (moduleExportsPattern.test(content)) {
    errors.push(`Disallowed CommonJS module export usage in ${rel}`);
  }
  if (exportsPattern.test(content)) {
    errors.push(`Disallowed CommonJS exports usage in ${rel}`);
  }
}

/**
 * @param {string} dir
 */
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (isIgnored(full)) continue;
    if (entry.isDirectory()) {
      walk(full);
    } else if (entry.isFile()) {
      checkFile(full);
    }
  }
}

walk(repoRoot);

if (errors.length > 0) {
  errors.forEach((msg) => console.error(`ERROR: ${msg}`));
  process.exit(1);
}

console.log("ESM verification passed.");
