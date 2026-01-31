import fs from "fs";
import path from "path";
import process from "process";
import { fail } from "../errors.js";
import { writeJsonFile } from "../fs.js";
import { resolveLlmTarget } from "./config.js";

/**
 * @typedef {Object} PlannerAssumption
 * @property {string} id
 * @property {string} text
 * @property {"low"|"medium"|"high"} confidence
 */
export interface PlannerAssumption {
    id: string;
    text: string;
    confidence: "low" | "medium" | "high";
}

/**
 * @typedef {Object} PlannerQuestion
 * @property {string} id
 * @property {string} text
 * @property {string} why_needed
 */
export interface PlannerQuestion {
    id: string;
    text: string;
    why_needed: string;
}

/**
 * @typedef {Object} PlannerStepVerification
 * @property {string} method
 * @property {string} success_criteria
 */
export interface PlannerStepVerification {
    method: string;
    success_criteria: string;
}

/**
 * @typedef {Object} PlannerStep
 * @property {string} id
 * @property {string} title
 * @property {string} action_type
 * @property {Record<string, any>} inputs
 * @property {string} expected_output
 * @property {PlannerStepVerification[]} verification
 * @property {"low"|"medium"|"high"} risk
 * @property {string} [rollback]
 */
export interface PlannerStep {
    id: string;
    title: string;
    action_type: string;
    inputs: Record<string, any>;
    expected_output: string;
    verification: PlannerStepVerification[];
    risk: "low" | "medium" | "high";
    rollback?: string;
}

/**
 * @typedef {Object} PlannerOutput
 * @property {string} goal
 * @property {PlannerAssumption[]} assumptions
 * @property {boolean} needs_clarification
 * @property {PlannerQuestion[]} questions
 * @property {PlannerStep[]} plan
 */
export interface PlannerOutput {
    goal: string;
    assumptions: PlannerAssumption[];
    needs_clarification: boolean;
    questions: PlannerQuestion[];
    plan: PlannerStep[];
}

/**
 * Capabilities available to the planner.
 */
export const CAPABILITIES = [
    "create_file",
    "update_file",
    "delete_file",
    "list_files",
    "read_file",
    "run_command", // Maybe? Restrictive for now?
    "ask_user"
];

/**
 * Strips outer markdown fences if present.
 * @param {string} raw
 * @returns {string}
 */
export function cleanJsonOutput(raw: string): string {
    let text = raw.trim();
    // Match strict outer fence: starts with ``` (optionally json), ends with ```
    const fenceStart = /^```([a-zA-Z]*)?\n/;
    const fenceEnd = /\n```$/;

    if (fenceStart.test(text) && fenceEnd.test(text)) {
        text = text.replace(fenceStart, "").replace(fenceEnd, "");
    }
    return text.trim();
}

/**
 * Simple .env loader to avoid dependencies.
 * Loads .env from CWD if present and not already set.
 */
function loadEnv() {
    const envPath = path.resolve(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, "utf8");
        content.split("\n").forEach(line => {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith("#")) {
                const [key, ...rest] = trimmed.split("=");
                if (key && rest.length > 0) {
                    const value = rest.join("=").trim().replace(/^["']|["']$/g, ""); // basic quote removal
                    if (!process.env[key.trim()]) {
                        process.env[key.trim()] = value;
                    }
                }
            }
        });
    }
}

/**
 * Validate the planner output against the schema and gates.
 * @param {unknown} json
 * @param {string[]} capabilities
 * @returns {{ valid: boolean; errors: string[]; warnings: string[]; parsed: PlannerOutput | null }}
 */
export function validatePlannerOutput(json: unknown, capabilities: string[]): { valid: boolean; errors: string[]; warnings: string[]; parsed: PlannerOutput | null } {
    const errors: string[] = [];
    const warnings: string[] = [];
    if (!json || typeof json !== "object") {
        return { valid: false, errors: ["Output must be a JSON object."], warnings: [], parsed: null };
    }

    const output = json as PlannerOutput;

    // 1. Schema Validation (Basic types)
    if (typeof output.goal !== "string") errors.push("Missing or invalid 'goal'.");
    if (!Array.isArray(output.assumptions)) errors.push("Missing or invalid 'assumptions' array.");
    if (typeof output.needs_clarification !== "boolean") errors.push("Missing or invalid 'needs_clarification'.");
    if (!Array.isArray(output.questions)) errors.push("Missing or invalid 'questions' array.");
    if (!Array.isArray(output.plan)) errors.push("Missing or invalid 'plan' array.");

    if (errors.length > 0) {
        return { valid: false, errors, warnings, parsed: null };
    }

    // 2. Clarification Rule
    if (output.needs_clarification) {
        if (output.questions.length === 0) {
            errors.push("If 'needs_clarification' is true, 'questions' must be non-empty.");
        }
        if (output.plan.length > 0) {
            errors.push("If 'needs_clarification' is true, 'plan' must be empty (raw []).");
        }
    } else {
        if (output.questions.length > 0) {
            errors.push("If 'needs_clarification' is false, 'questions' must be empty.");
        }
        if (output.plan.length === 0) {
            warnings.push("Plan is empty but needs_clarification is false.");
        }
    }

    // 3. Step Validation
    if (Array.isArray(output.plan)) {
        output.plan.forEach((step, idx) => {
            if (!step.id) errors.push(`Step ${idx} missing 'id'.`);
            if (!step.action_type) errors.push(`Step ${idx} missing 'action_type'.`);
            else if (!capabilities.includes(step.action_type)) {
                errors.push(`Step ${idx} uses unknown action_type '${step.action_type}'. Allowed: ${capabilities.join(", ")}.`);
            }

            if (!step.verification || !Array.isArray(step.verification)) {
                errors.push(`Step ${idx} missing 'verification' array.`);
            } else {
                step.verification.forEach((v, vIdx) => {
                    if (!v.method || !v.method.trim()) {
                        errors.push(`Step ${idx} verification ${vIdx} missing method.`);
                    } else if (v.method.trim().length < 10) {
                        warnings.push(`Step ${idx} verification ${vIdx} method is short (<10 chars).`);
                    }

                    if (!v.success_criteria || !v.success_criteria.trim()) {
                        errors.push(`Step ${idx} verification ${vIdx} missing success_criteria.`);
                    } else if (v.success_criteria.trim().length < 10) {
                        warnings.push(`Step ${idx} verification ${vIdx} success_criteria is short (<10 chars).`);
                    }
                });
            }

            if (!["low", "medium", "high"].includes(step.risk)) {
                errors.push(`Step ${idx} has invalid risk '${step.risk}'. Must be exactly low|medium|high.`);
            }
        });
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings,
        parsed: errors.length === 0 ? output : null
    };
}

/**
 * Call the LLM to generate a plan.
 * @param {string} promptPath
 * @param {string} goal
 * @param {string} context
 * @returns {Promise<{ rawText: string; target: import("./config.js").LlmTarget }>} Raw output string
 */
export async function generatePlanFromLLM(promptPath: string, goal: string, context: string): Promise<{ rawText: string; target: import("./config.js").LlmTarget }> {
    loadEnv();

    // Read the template
    if (!fs.existsSync(promptPath)) {
        throw new Error(`Prompt template not found at ${promptPath}`);
    }
    const template = fs.readFileSync(promptPath, "utf8");

    // Construct the full prompt
    const fullPrompt = `
${template}

## Current Task
Goal: ${goal}
Context: ${context}
Capabilities: ${CAPABILITIES.join(", ")}
Constraints: No execution, Plan only.
`;

    const target = resolveLlmTarget("planner");
    const endpoint = target.endpoint;
    const model = target.model;
    const authHeader = target.authHeader || "Authorization";
    const authPrefix = target.authPrefix || "Bearer ";

    console.error(`Connecting to LLM: provider=${target.provider} model=${model} endpoint=${endpoint}...`);

    try {
        const response = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                [authHeader]: `${authPrefix}${target.apiKey}`
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    { role: "system", content: "You are a precise planning engine. Output only JSON." },
                    { role: "user", content: fullPrompt }
                ],
                response_format: { type: "json_object" },
                temperature: 0.1
            })
        });

        if (!response.ok) {
            const body = await response.text();
            throw new Error(`LLM request failed: ${response.status} ${response.statusText} - ${body}`);
        }

        const data: any = await response.json();
        const content = data.choices[0].message.content;
        return { rawText: content, target };
    } catch (err: unknown) {
        throw new Error(`LLM interaction failed: ${(err as Error).message}`);
    }
}
