# Make/planner.mk
# Planner-related targets

$(call register_target,planner,PLANNER,Run the Planner LLM (raw mode).,make planner GOAL=\"...\" CONTEXT=\"...\")
.PHONY: planner
planner:
	@set -eu; \
	GOAL="$${GOAL:-}"; \
	CONTEXT="$${CONTEXT:-repo uses /docs folder}"; \
	RUN="$${RUN:-}"; \
	if [ -z "$$GOAL" ]; then \
		echo "ERROR: GOAL is required. Example: make planner GOAL=\"Add new feature\""; \
		exit 2; \
	fi; \
	RUN_FLAG=""; \
	if [ ! -z "$$RUN" ]; then \
		RUN_FLAG="--run $$RUN"; \
	fi; \
	npm run dev -- planner -- --goal "$$GOAL" --context "$$CONTEXT" $$RUN_FLAG

$(call register_target,planner-demo,PLANNER,Run the Planner with a canned demo goal.)
.PHONY: planner-demo
planner-demo:
	@echo "Running planner demo with default goal..."
	$(MAKE) planner GOAL="Add a section on 'Planner' to the docs/architecture.md file" CONTEXT="We have a docs/ folder and existing architecture docs."

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
