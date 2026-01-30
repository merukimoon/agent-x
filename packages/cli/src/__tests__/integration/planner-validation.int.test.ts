
import { describe, it, expect } from 'vitest';
import { validatePlannerOutput, cleanJsonOutput } from '../../../../../scripts/agentic/llm-planner';

const CAPABILITIES = ["create_file", "read_file"];

describe('Planner Validation', () => {
    it('accepts valid plan', () => {
        const input = {
            goal: "Task",
            assumptions: [],
            needs_clarification: false,
            questions: [],
            plan: [
                {
                    id: "1", action_type: "create_file", title: "Create",
                    inputs: {}, expected_output: "Done",
                    verification: [{ method: "Check file exists", success_criteria: "File is present" }],
                    risk: "low"
                }
            ]
        };
        const result = validatePlannerOutput(input, CAPABILITIES);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    it('rejects needs_clarification=false with questions', () => {
        const input = {
            goal: "Task",
            assumptions: [],
            needs_clarification: false,
            questions: [{ id: "q1", text: "Why?", why_needed: "Confusion" }],
            plan: []
        };
        const result = validatePlannerOutput(input, CAPABILITIES);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain("If 'needs_clarification' is false, 'questions' must be empty.");
    });

    it('rejects needs_clarification=true with plan', () => {
        const input = {
            goal: "Task",
            assumptions: [],
            needs_clarification: true,
            questions: [{ id: "q1", text: "Why?", why_needed: "Confusion" }],
            plan: [{ id: "1", action_type: "create_file", risk: "low", verification: [] }] // dummy
        };
        const result = validatePlannerOutput(input, CAPABILITIES);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain("If 'needs_clarification' is true, 'plan' must be empty (raw []).");
    });

    it('warns on needs_clarification=false with empty plan', () => {
        const input = {
            goal: "Task",
            assumptions: [],
            needs_clarification: false,
            questions: [],
            plan: []
        };
        const result = validatePlannerOutput(input, CAPABILITIES);
        expect(result.valid).toBe(true); // Valid but warns
        expect(result.warnings).toContain("Plan is empty but needs_clarification is false.");
    });

    it('rejects invalid risk enum', () => {
        const input = {
            goal: "Task",
            assumptions: [],
            needs_clarification: false,
            questions: [],
            plan: [
                {
                    id: "1", action_type: "create_file", title: "Create",
                    inputs: {}, expected_output: "Done",
                    verification: [{ method: "Check", success_criteria: "Done" }],
                    risk: "minimal" // Invalid
                }
            ]
        };
        const result = validatePlannerOutput(input, CAPABILITIES);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes("invalid risk"))).toBe(true);
    });

    it('warns on short verification', () => {
        const input = {
            goal: "Task",
            assumptions: [],
            needs_clarification: false,
            questions: [],
            plan: [
                {
                    id: "1", action_type: "create_file", title: "Create",
                    inputs: {}, expected_output: "Done",
                    verification: [{ method: "short", success_criteria: "short" }],
                    risk: "low"
                }
            ]
        };
        const result = validatePlannerOutput(input, CAPABILITIES);
        expect(result.valid).toBe(true);
        expect(result.warnings.some(w => w.includes("method is short"))).toBe(true);
    });
});

describe('Json Cleaning', () => {
    it('strips markdown', () => {
        const raw = "```json\n{\"foo\":1}\n```";
        expect(cleanJsonOutput(raw)).toBe("{\"foo\":1}");
    });

    it('leaves clean json', () => {
        const raw = "{\"foo\":1}";
        expect(cleanJsonOutput(raw)).toBe("{\"foo\":1}");
    });

    it('ignores internal fencelike structures', () => {
        const raw = "{\"foo\": \"```code```\"}";
        expect(cleanJsonOutput(raw)).toBe("{\"foo\": \"```code```\"}");
    });
});
