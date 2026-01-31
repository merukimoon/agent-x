
import fs from "fs";
import path from "path";
import process from "process";

export interface ScaffoldOptions {
    name?: string;      // Used for timestamp-based ID generation (Legacy script style)
    runId?: string;     // Explicit ID (CLI style), overrides name+timestamp logic
    cwd?: string;
    log?: (msg: string) => void;
    goal?: string;      // Content for inputs/request.md
    context?: string;   // Content for inputs/context.md
}

export class ScaffoldService {
    static generateTimestamp() {
        const now = new Date();
        const Y = now.getUTCFullYear();
        const m = String(now.getUTCMonth() + 1).padStart(2, '0');
        const d = String(now.getUTCDate()).padStart(2, '0');
        const H = String(now.getUTCHours()).padStart(2, '0');
        const M = String(now.getUTCMinutes()).padStart(2, '0');
        const s = String(now.getUTCSeconds()).padStart(2, '0');

        return {
            ts: `${Y}-${m}-${d}_${H}${M}`,
            iso: `${Y}-${m}-${d}T${H}:${M}:${s}Z`
        };
    }

    static createRun(options: ScaffoldOptions): string {
        const { name } = options;
        const cwd = options.cwd || process.cwd();
        const log = options.log || console.log;

        const { ts, iso } = this.generateTimestamp();

        let runId = options.runId;
        if (!runId) {
            if (!name) {
                throw new Error('NAME is required. Example: name="docs-pr-audit"');
            }
            if (!/^[A-Za-z0-9._-]+$/.test(name)) {
                throw new Error('NAME must use only A-Z a-z 0-9 . _ -');
            }
            runId = `${ts}-${name}`;
        }

        const runDir = path.join(cwd, "runs", runId);

        if (fs.existsSync(runDir)) {
            throw new Error(`Run already exists: ${runDir}`);
        }

        // Create directories
        [
            "inputs",
            "outputs/coordinator",
            "outputs/decision-maker",
            "outputs/ciso",
            "outputs/pr-reviewer",
            "artifacts",
            "summary"
        ].forEach(sub => {
            fs.mkdirSync(path.join(runDir, sub), { recursive: true });
        });

        // Create run.json
        const runJson = {
            id: runId,
            created_at: iso,
            slug: name,
            flow: "",
            status: "in_progress",
            related_links: [],
            notes: ""
        };
        fs.writeFileSync(path.join(runDir, "run.json"), JSON.stringify(runJson, null, 2));

        // Create README.md
        const readmeContent = `# Run: ${runId}
    
    This folder captures inputs, agent outputs, artifacts, and the final summary for a single run.
    
    - Contract: docs/agent-contract.md
    - Flows: docs/flows.md
    
    ## Status
    
    - Status: in_progress
    - Created at (UTC): ${iso}
    
    ## How to use
    
    1) Fill inputs/request.md and inputs/context.md.
    2) Each agent writes to its folder under outputs/.
    3) Put produced files or diffs under artifacts/ (if any).
    4) Produce the end-of-run summary in summary/final.md.
    `;
        fs.writeFileSync(path.join(runDir, "README.md"), readmeContent);

        // Create inputs/request.md
        const requestContent = options.goal
            ? options.goal + "\n"
            : `# Task request

Fill this file with the TaskRequest for the run.

## TaskRequest

- task_id: TODO
- title: TODO
- goal: TODO

## Inputs (optional)

List any inputs the agents should use.

- name: TODO
  kind: text, artifact, reference, or unknown
  value: TODO

## Acceptance criteria (optional)

- [ ] TODO

## Constraints and policy notes

Summarize key constraints for this run (privacy, allowed tools, forbidden actions).
If a formal Policy document exists elsewhere, link it here.

- Policy summary: TODO
`;
        fs.writeFileSync(path.join(runDir, "inputs", "request.md"), requestContent);

        // Create inputs/context.md
        const contextContent = options.context
            ? options.context
            : `# Context

Paste or link the context needed to execute the run.

## Related links

- TODO

## Repository state

- Branch/commit: TODO
- Relevant paths: TODO

## Notes

- TODO
`;
        fs.writeFileSync(path.join(runDir, "inputs", "context.md"), contextContent);

        // Create outputs skeletons
        const agents = [
            { name: "coordinator", role: "Coordinator", msg: "Fill inputs/request.md and inputs/context.md." },
            { name: "decision-maker", role: "Decision Maker", msg: "Awaiting a decision request from the coordinator." },
            { name: "ciso", role: "CISO", msg: "Awaiting artifacts and scope to review." },
            { name: "pr-reviewer", role: "PR Reviewer", msg: "Awaiting PR link or diff summary and context." }
        ];

        agents.forEach(agent => {
            const outputJson = {
                contract_version: "agent-contract/0.1",
                run_id: runId,
                task_id: "TODO",
                agent: {
                    name: agent.name,
                    role: agent.role,
                    version: ""
                },
                status: "blocked",
                summary: "",
                decisions: [],
                next_steps: [],
                artifacts: [],
                errors: [
                    {
                        code: "BLOCKED_DEPENDENCY",
                        message: agent.msg,
                        retryable: true
                    }
                ],
                logs: []
            };
            fs.writeFileSync(path.join(runDir, "outputs", agent.name, "result.json"), JSON.stringify(outputJson, null, 2));

            fs.writeFileSync(path.join(runDir, "outputs", agent.name, "notes.md"), `# ${agent.role} notes\n\nUse this file for notes.\n`);
        });

        // Artifacts .gitkeep
        fs.writeFileSync(path.join(runDir, "artifacts", ".gitkeep"), "");

        // Summary
        const summaryContent = `# Final run summary
    
    ## Outcome
    
    - Status: TODO (pass | warning | block | partial)
    - Summary: TODO
    
    ## Decisions
    
    - TODO
    
    ## Artifacts produced
    
    List run artifacts and where they live.
    
    - TODO
    
    ## Follow-ups
    
    - TODO
    `;
        fs.writeFileSync(path.join(runDir, "summary", "final.md"), summaryContent);

        log(`Created run: ${runDir}/`);
        return runDir;
    }
}
