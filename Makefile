.PHONY: help run-new run-tree agent flow run-status

help:
	@echo "agentic-squad-framework: manual run scaffolding"
	@echo ""
	@echo "Targets:"
	@echo "  make help"
	@echo "    Print available targets."
	@echo ""
	@echo "  make run-new NAME=\"<short-slug>\""
	@echo "    Create a new run directory under runs/ with a UTC timestamp prefix."
	@echo "    Example: runs/2026-01-17_0930-docs-pr-audit/"
	@echo ""
	@echo "  make run-tree RUN=\"<run-folder-name>\""
	@echo "    Print a tree (or listing) for the specified run folder."
	@echo ""
	@echo "  make run-status RUN=\"<run-folder-name>\""
	@echo "    Print plan status summary for the specified run."

run-new:
	@set -eu; \
	NAME="$${NAME:-}"; \
	if [ -z "$$NAME" ]; then \
		echo "ERROR: NAME is required. Example: make run-new NAME=\"docs-pr-audit\""; \
		exit 2; \
	fi; \
	case "$$NAME" in \
		*[!A-Za-z0-9._-]* ) \
			echo "ERROR: NAME must use only A-Z a-z 0-9 . _ -"; \
			exit 2; \
			;; \
	esac; \
	TS="$$(date -u +%Y-%m-%d_%H%M)"; \
	CREATED_AT="$$(date -u +%Y-%m-%dT%H:%M:%SZ)"; \
	RUN_ID="$${TS}-$${NAME}"; \
	RUN_DIR="runs/$${RUN_ID}"; \
	if [ -e "$$RUN_DIR" ]; then \
		echo "ERROR: run already exists: $$RUN_DIR"; \
		exit 2; \
	fi; \
	mkdir -p "$$RUN_DIR/inputs" "$$RUN_DIR/outputs/coordinator" "$$RUN_DIR/outputs/decision-maker" "$$RUN_DIR/outputs/ciso" "$$RUN_DIR/outputs/pr-reviewer" "$$RUN_DIR/artifacts" "$$RUN_DIR/summary"; \
	printf '%s\n' "{\n  \"id\": \"$$RUN_ID\",\n  \"created_at\": \"$$CREATED_AT\",\n  \"slug\": \"$$NAME\",\n  \"flow\": \"\",\n  \"status\": \"in_progress\",\n  \"related_links\": [],\n  \"notes\": \"\"\n}" > "$$RUN_DIR/run.json"; \
	printf '%s\n' "# Run: $$RUN_ID\n\nThis folder captures inputs, agent outputs, artifacts, and the final summary for a single run.\n\n- Contract: docs/agent-contract.md\n- Flows: docs/flows.md\n\n## Status\n\n- Status: in_progress\n- Created at (UTC): $$CREATED_AT\n\n## How to use\n\n1) Fill inputs/request.md and inputs/context.md.\n2) Each agent writes to its folder under outputs/.\n3) Put produced files or diffs under artifacts/ (if any).\n4) Produce the end-of-run summary in summary/final.md.\n" > "$$RUN_DIR/README.md"; \
	printf '%s\n' "# Task request\n\nFill this file with the TaskRequest for the run.\n\n## TaskRequest\n\n- task_id: TODO\n- title: TODO\n- goal: TODO\n\n## Inputs (optional)\n\nList any inputs the agents should use.\n\n- name: TODO\n  kind: text | artifact | reference | unknown\n  value: TODO\n\n## Acceptance criteria (optional)\n\n- [ ] TODO\n\n## Constraints and policy notes\n\nSummarize key constraints for this run (privacy, allowed tools, forbidden actions).\nIf a formal Policy document exists elsewhere, link it here.\n\n- Policy summary: TODO\n" > "$$RUN_DIR/inputs/request.md"; \
	printf '%s\n' "# Context\n\nPaste or link the context needed to execute the run.\n\n## Related links\n\n- TODO\n\n## Repository state\n\n- Branch/commit: TODO\n- Relevant paths: TODO\n\n## Notes\n\n- TODO\n" > "$$RUN_DIR/inputs/context.md"; \
	printf '%s\n' "{\n  \"contract_version\": \"agent-contract/0.1\",\n  \"run_id\": \"$$RUN_ID\",\n  \"task_id\": \"TODO\",\n  \"agent\": {\n    \"name\": \"coordinator\",\n    \"role\": \"Coordinator\",\n    \"version\": \"\"\n  },\n  \"status\": \"blocked\",\n  \"summary\": \"\",\n  \"decisions\": [],\n  \"next_steps\": [],\n  \"artifacts\": [],\n  \"errors\": [\n    {\n      \"code\": \"BLOCKED_DEPENDENCY\",\n      \"message\": \"Fill inputs/request.md and inputs/context.md.\",\n      \"retryable\": true\n    }\n  ],\n  \"logs\": []\n}" > "$$RUN_DIR/outputs/coordinator/result.json"; \
	printf '%s\n' "# Coordinator notes\n\nUse this file for free-form notes during coordination.\n\nSuggested content:\n\n- Subtasks and owners\n- Open questions\n- Links to relevant artifacts\n" > "$$RUN_DIR/outputs/coordinator/notes.md"; \
	printf '%s\n' "{\n  \"contract_version\": \"agent-contract/0.1\",\n  \"run_id\": \"$$RUN_ID\",\n  \"task_id\": \"TODO\",\n  \"agent\": {\n    \"name\": \"decision-maker\",\n    \"role\": \"Decision Maker\",\n    \"version\": \"\"\n  },\n  \"status\": \"blocked\",\n  \"summary\": \"\",\n  \"decisions\": [],\n  \"next_steps\": [],\n  \"artifacts\": [],\n  \"errors\": [\n    {\n      \"code\": \"BLOCKED_DEPENDENCY\",\n      \"message\": \"Awaiting a decision request from the coordinator.\",\n      \"retryable\": true\n    }\n  ],\n  \"logs\": []\n}" > "$$RUN_DIR/outputs/decision-maker/result.json"; \
	printf '%s\n' "# Decision Maker notes\n\nUse this file to draft options, tradeoffs, and rationale before recording decisions in result.json.\n\nSuggested content:\n\n- Options considered\n- Tradeoffs\n- Decision rationale\n- Delegated next steps\n" > "$$RUN_DIR/outputs/decision-maker/notes.md"; \
	printf '%s\n' "{\n  \"contract_version\": \"agent-contract/0.1\",\n  \"run_id\": \"$$RUN_ID\",\n  \"task_id\": \"TODO\",\n  \"agent\": {\n    \"name\": \"ciso\",\n    \"role\": \"CISO\",\n    \"version\": \"\"\n  },\n  \"status\": \"blocked\",\n  \"summary\": \"\",\n  \"decisions\": [],\n  \"next_steps\": [],\n  \"artifacts\": [],\n  \"errors\": [\n    {\n      \"code\": \"BLOCKED_DEPENDENCY\",\n      \"message\": \"Awaiting artifacts and scope to review.\",\n      \"retryable\": true\n    }\n  ],\n  \"logs\": []\n}" > "$$RUN_DIR/outputs/ciso/result.json"; \
	printf '%s\n' "# CISO notes\n\nUse this file to draft findings and evidence before recording them as structured artifacts in result.json.\n\nSuggested content:\n\n- Scope\n- Findings (block vs warning)\n- Recommended mitigations\n" > "$$RUN_DIR/outputs/ciso/notes.md"; \
	printf '%s\n' "{\n  \"contract_version\": \"agent-contract/0.1\",\n  \"run_id\": \"$$RUN_ID\",\n  \"task_id\": \"TODO\",\n  \"agent\": {\n    \"name\": \"pr-reviewer\",\n    \"role\": \"PR Reviewer\",\n    \"version\": \"\"\n  },\n  \"status\": \"blocked\",\n  \"summary\": \"\",\n  \"decisions\": [],\n  \"next_steps\": [],\n  \"artifacts\": [],\n  \"errors\": [\n    {\n      \"code\": \"BLOCKED_DEPENDENCY\",\n      \"message\": \"Awaiting PR link or diff summary and context.\",\n      \"retryable\": true\n    }\n  ],\n  \"logs\": []\n}" > "$$RUN_DIR/outputs/pr-reviewer/result.json"; \
	printf '%s\n' "# PR Reviewer notes\n\nUse this file to draft review notes before recording structured findings in result.json.\n\nSuggested content:\n\n- Summary of change set\n- Blocking issues\n- Non blocking improvements\n- Questions\n- Escalations to QA, CISO, or Legal\n" > "$$RUN_DIR/outputs/pr-reviewer/notes.md"; \
	printf '%s\n' "" > "$$RUN_DIR/artifacts/.gitkeep"; \
	printf '%s\n' "# Final run summary\n\n## Outcome\n\n- Status: TODO (pass | warning | block | partial)\n- Summary: TODO\n\n## Decisions\n\n- TODO\n\n## Artifacts produced\n\nList run artifacts and where they live.\n\n- TODO\n\n## Follow-ups\n\n- TODO\n" > "$$RUN_DIR/summary/final.md"; \
	echo "Created run: $$RUN_DIR/"

run-tree:
	@set -eu; \
	RUN="$${RUN:-}"; \
	if [ -z "$$RUN" ]; then \
		echo "ERROR: RUN is required. Example: make run-tree RUN=\"2026-01-17_0930-docs-pr-audit\""; \
		exit 2; \
	fi; \
	RUN_DIR="runs/$$RUN"; \
	if [ ! -d "$$RUN_DIR" ]; then \
		echo "ERROR: run directory not found: $$RUN_DIR"; \
		exit 2; \
	fi; \
	if command -v tree >/dev/null 2>&1; then \
		tree -a "$$RUN_DIR"; \
	else \
		echo "tree not found; using find"; \
		find "$$RUN_DIR" -print; \
	fi

.PHONY: run-status

run-status:
	@set -eu; \
	RUN="$${RUN:-}"; \
	if [ -z "$$RUN" ]; then \
		echo "ERROR: RUN is required. Example: make run-status RUN=\"2026-01-18_1124-pr-docs-and-config-3\""; \
		exit 2; \
	fi; \
	node scripts/agentic.mjs status --run "$$RUN"

.PHONY: agent

agent:
	@set -eu; \
	RUN="$${RUN:-}"; \
	AGENT="$${AGENT:-}"; \
	DRY="$${DRY:-1}"; \
	if [ -z "$$RUN" ]; then \
		echo "ERROR: RUN is required. Example: make agent RUN=\"2026-01-17_0930-docs-pr-audit\" AGENT=\"coordinator\" DRY=1"; \
		exit 2; \
	fi; \
	if [ -z "$$AGENT" ]; then \
		echo "ERROR: AGENT is required. Supported: coordinator decision-maker pr-reviewer ciso"; \
		exit 2; \
	fi; \
	DRY_FLAG=""; \
	if [ "$$DRY" != "0" ]; then \
		DRY_FLAG="--dry-run"; \
	fi; \
	node scripts/agentic.mjs agent "$$AGENT" --run "$$RUN" $$DRY_FLAG

.PHONY: flow

flow:
	@set -eu; \
	RUN="$${RUN:-}"; \
	DRY="$${DRY:-1}"; \
	if [ -z "$$RUN" ]; then \
		echo "ERROR: RUN is required. Example: make flow RUN=\"2026-01-17_0930-docs-pr-audit\" DRY=1"; \
		exit 2; \
	fi; \
	DRY_FLAG=""; \
	if [ "$$DRY" != "0" ]; then \
		DRY_FLAG="--dry-run"; \
	fi; \
	node scripts/agentic.mjs flow --run "$$RUN" $$DRY_FLAG
