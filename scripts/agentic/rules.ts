import fs from "fs";
import path from "path";
import {
  FLOW_ARCH_CHANGE,
  RULES_DIR,
  isAgentName,
} from "./core.ts";
import { fail } from "./errors.ts";

/**
 * Find matching keywords in text.
 * @param {string} text
 * @param {string[]} keywords
 * @returns {string[]}
 */
function findKeywords(text, keywords) {
  const lower = text.toLowerCase();
  /** @type {string[]} */
  const found = [];
  const seen = new Set();
  keywords.forEach((keyword) => {
    const key = keyword.toLowerCase();
    if (!seen.has(key) && lower.includes(key)) {
      found.push(keyword);
      seen.add(key);
    }
  });
  return found;
}

/**
 * Load rule packs from the rules directory.
 * @returns {import("./core.ts").RulePack[]}
 */
export function loadRulePacks() {
  if (!fs.existsSync(RULES_DIR) || !fs.statSync(RULES_DIR).isDirectory()) {
    fail(`Rules directory not found: ${RULES_DIR}`);
  }
  const files = fs.readdirSync(RULES_DIR).filter((f) => f.endsWith(".json"));
  if (files.length === 0) {
    fail(`No rule packs found in ${RULES_DIR}`);
  }
  /** @type {import("./core.ts").RulePack[]} */
  const packs = [];
  files.forEach((file) => {
    const fullPath = path.join(RULES_DIR, file);
    try {
      const raw = fs.readFileSync(fullPath, "utf8");
      const parsed = JSON.parse(raw);
      validateRulePack(parsed, fullPath);
      packs.push(parsed);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      fail(`Failed to load rule pack ${fullPath}: ${reason}`);
    }
  });
  return packs;
}

/**
 * Validate rule pack structure.
 * @param {unknown} pack
 * @param {string} source
 */
export function validateRulePack(pack, source) {
  if (
    !pack ||
    typeof pack !== "object" ||
    typeof /** @type {import("./core.ts").RulePack} */ (pack).flow_type !== "string" ||
    !Array.isArray(/** @type {import("./core.ts").RulePack} */ (pack).keywords) ||
    !Array.isArray(/** @type {import("./core.ts").RulePack} */ (pack).steps)
  ) {
    fail(`Rule pack invalid at ${source}`);
  }
  const asPack = /** @type {import("./core.ts").RulePack} */ (pack);
  asPack.steps.forEach((step, index) => {
    if (!step || typeof step !== "object") {
      fail(`Rule pack step ${index} invalid in ${source}`);
    }
    if (!isAgentName(step.agent)) {
      fail(`Rule pack step ${index} has invalid agent in ${source}: ${String(step.agent)}`);
    }
    if (!Array.isArray(step.depends_on)) {
      fail(`Rule pack step ${index} depends_on invalid in ${source}`);
    }
  });
}

/**
 * Classify flow based on request and context contents using rule packs.
 * @param {string} requestText
 * @param {string} contextText
 * @returns {{ pack: import("./core.ts").RulePack; signals: string[]; confidence: import("./core.ts").ConfidenceLevel }}
 */
export function classifyFlow(requestText, contextText) {
  const combined = `${requestText}\n${contextText}`;
  const packs = loadRulePacks();

  /** @type {{ pack: import("./core.ts").RulePack; matches: string[] }[]} */
  const scored = packs.map((pack) => {
    const matches = findKeywords(combined, pack.keywords);
    return { pack, matches };
  });

  /** @type {{ pack: import("./core.ts").RulePack; matches: string[] } | null} */
  let best = null;
  let bestCount = 0;
  scored.forEach((entry) => {
    const count = entry.matches.length;
    if (count > bestCount) {
      best = entry;
      bestCount = count;
    } else if (count === bestCount && count > 0) {
      if (entry.pack.flow_type === FLOW_ARCH_CHANGE) {
        best = entry;
      }
    }
  });

  if (!best || bestCount === 0) {
    const available = packs.map((p) => p.flow_type).join(", ");
    fail(
      `Unable to classify request into a known flow type. Add clearer keywords to inputs. Available flows: ${available}`
    );
  }

  const chosen = /** @type {{ pack: import("./core.ts").RulePack; matches: string[] }} */ (best);
  const confidence =
    bestCount >= 3 ? "high" : bestCount === 2 ? "medium" : "low";
  const signals = chosen.matches.map((k) => `keyword:${k}`);
  return {
    pack: chosen.pack,
    signals,
    confidence,
  };
}
