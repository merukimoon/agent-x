// @ts-check

import fs from "fs";
import path from "path";
import { fail } from "./errors.ts";
import { writeJsonFile } from "./fs.ts";

/**
 * @typedef {Object} PlannerAssumption
 * @property {string} id
 * @property {string} text
 * @property {"low"|"medium"|"high"} confidence
 */

/**
 * @typedef {Object} PlannerQuestion
 * @property {string} id
 * @property {string} text
 * @property {string} why_needed
 */

/**
 * @typedef {Object} PlannerStepVerification
 * @property {string} method
 * @property {string} success_criteria
 */

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

/**
 * @typedef {Object} PlannerOutput
 * @property {string} goal
 * @property {PlannerAssumption[]} assumptions
 * @property {boolean} needs_clarification
 * @property {PlannerQuestion[]} questions
 * @property {PlannerStep[]} plan
 */

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
 * Validate the planner output against the schema and gates.
 * @param {unknown} json
 * @param {string[]} capabilities
 * @returns {{ valid: boolean; errors: string[]; parsed: PlannerOutput | null }}
 */
export function validatePlannerOutput(json, capabilities) {
    const errors = [];
    if (!json || typeof json !== "object") {
        return { valid: false, errors: ["Output must be a JSON object."], parsed: null };
    }

    const output = /** @type {PlannerOutput} */ (json);

    // 1. Schema Validation (Basic types)
    if (typeof output.goal !== "string") errors.push("Missing or invalid 'goal'.");
    if (!Array.isArray(output.assumptions)) errors.push("Missing or invalid 'assumptions' array.");
    if (typeof output.needs_clarification !== "boolean") errors.push("Missing or invalid 'needs_clarification'.");
    if (!Array.isArray(output.questions)) errors.push("Missing or invalid 'questions' array.");
    if (!Array.isArray(output.plan)) errors.push("Missing or invalid 'plan' array.");

    // 2. Clarification Rule
    if (output.needs_clarification) {
        if (output.questions.length === 0) {
            errors.push("If 'needs_clarification' is true, 'questions' must be non-empty.");
        }

        if (output.plan.length > 0) {
            errors.push("If 'needs_clarification' is true, 'plan' must be empty (raw []).");
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
                    if (!v.method || !v.success_criteria) {
                        errors.push(`Step ${idx} verification ${vIdx} missing method or success_criteria.`);
                    }
                });
            }

            if (!["low", "medium", "high"].includes(step.risk)) {
                errors.push(`Step ${idx} has invalid risk '${step.risk}'. Must be low|medium|high.`);
            }
        });
    }

    return {
        valid: errors.length === 0,
        errors,
        parsed: errors.length === 0 ? output : null
    };
}

/**
 * Call the LLM to generate a plan.
 * @param {string} promptPath
 * @param {string} goal
 * @param {string} context
 * @returns {Promise<unknown>} JSON response
 */
export async function generatePlanFromLLM(promptPath, goal, context) {
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

    // Retrieve API Key
    const apiKey = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) {
        throw new Error("LLM_API_KEY or OPENAI_API_KEY environment variable is required.");
    }

    // Call LLM (assuming OpenAI-compatible for now as a default standby)
    const endpoint = process.env.LLM_ENDPOINT || "https://api.openai.com/v1/chat/completions";
    const model = process.env.LLM_MODEL || "gpt-4-turbo-preview"; // Default to a strong model

    console.error(`Connecting to LLM: ${model} at ${endpoint}...`);

    try {
        const response = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
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

        const data = await response.json();
        const content = data.choices[0].message.content;
        return JSON.parse(content);
    } catch (err) {
        throw new Error(`LLM interaction failed: ${err.message}`);
    }
}
