
# Make/planner.mk
# Planner-related targets

$(call register_target,planner,PLANNER,Run the Planner LLM (raw mode).,make planner GOAL=\"...\" CONTEXT=\"...\" RUN=\"<run-id>\")
.PHONY: planner
planner:
	@set -eu; \
	GOAL="$${GOAL:-}"; \
	CONTEXT="$${CONTEXT:-repo uses /docs folder}"; \
	RUN="$${RUN:-}"; \
	if [ -z "$$GOAL" ]; then \
		echo "ERROR: GOAL is required. Example: make planner GOAL=\"Add new feature\" CONTEXT=\"repo uses /docs\" RUN=\"2026-01-23_0708-idea-step-demo\""; \
		exit 2; \
	fi; \
	if [ -z "$$RUN" ]; then \
		echo "ERROR: RUN is required. Create one with: make run-new NAME=\"your-run-name\""; \
		exit 2; \
	fi; \
	RUN_DIR="runs/$$RUN"; \
	if [ ! -d "$$RUN_DIR" ]; then \
		echo "ERROR: run directory not found: $$RUN_DIR. Create one with: make run-new NAME=\"your-run-name\""; \
		exit 2; \
	fi; \
	mkdir -p "$$RUN_DIR/inputs"; \
	printf "%s\n" "$$GOAL" > "$$RUN_DIR/inputs/request.md"; \
	printf "%s\n" "$$CONTEXT" > "$$RUN_DIR/inputs/context.md"; \
	npm run dev -- planner --run "$$RUN"

$(call register_target,planner-demo,PLANNER,Run the Planner with a canned demo goal.,make planner-demo RUN=\"<run-id>\")
.PHONY: planner-demo
planner-demo:
	@set -eu; \
	RUN="$${RUN:-}"; \
	if [ -z "$$RUN" ]; then \
		echo "ERROR: RUN is required. Create one with: make run-new NAME=\"planner-demo\""; \
		exit 2; \
	fi; \
	echo "Running planner demo with default goal into $$RUN..."; \
	$(MAKE) planner GOAL="Add a section on 'Planner' to the docs/architecture.md file" CONTEXT="We have a docs/ folder and existing architecture docs." RUN="$$RUN"

$(call register_target,orchestrator-planner,PLANNER,Run Planner via Orchestrator (Policy Enforced).,make orchestrator-planner GOAL=\"...\" CONTEXT=\"...\")
.PHONY: orchestrator-planner
orchestrator-planner:
	@set -eu; \
	GOAL="$${GOAL:-}"; \
	CONTEXT="$${CONTEXT:-}"; \
	if [ -z "$$GOAL" ]; then \
		echo "ERROR: GOAL is required. Example: make orchestrator-planner GOAL=\"...\""; \
		exit 2; \
	fi; \
	node --import tsx scripts/orchestrator/run-planner-with-policy.ts --goal "$$GOAL" --context "$$CONTEXT"

$(call register_target,orchestrator-planner-architect,PLANNER,Run Planner -> Architect end-to-end flow.,make orchestrator-planner-architect GOAL=\"...\" CONTEXT=\"...\")
.PHONY: orchestrator-planner-architect
orchestrator-planner-architect:
	@set -eu; \
	GOAL="$${GOAL:-}"; \
	CONTEXT="$${CONTEXT:-}"; \
	if [ -z "$$GOAL" ]; then \
		echo "ERROR: GOAL is required. Example: make orchestrator-planner-architect GOAL=\"...\""; \
		exit 2; \
	fi; \
	node --import tsx scripts/orchestrator/run-planner-architect-with-policy.ts --goal "$$GOAL" --context "$$CONTEXT"
