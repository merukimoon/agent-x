# Make/agents.mk
# Agent Execution targets

$(call register_target,agent,AGENTS,Run a single agent for a run.,make agent AGENT=coordinator RUN=... DRY=1)
.PHONY: agent
agent:
	@set -eu; \
	RUN="$${RUN:-}"; \
	AGENT="$${AGENT:-}"; \
	DRY="$${DRY:-1}"; \
	if [ -z "$$RUN" ]; then \
		echo "ERROR: RUN is required. Example: make agent RUN=\"...\" AGENT=\"coordinator\""; \
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
	npm run dev -- agent "$$AGENT" --run "$$RUN" $$DRY_FLAG

$(call register_target,flow,AGENTS,Execute the full plan/flow for a run.,make flow RUN=... DRY=1)
.PHONY: flow
flow:
	@set -eu; \
	RUN="$${RUN:-}"; \
	DRY="$${DRY:-1}"; \
	if [ -z "$$RUN" ]; then \
		echo "ERROR: RUN is required. Example: make flow RUN=\"...\" DRY=1"; \
		exit 2; \
	fi; \
	DRY_FLAG=""; \
	if [ "$$DRY" != "0" ]; then \
		DRY_FLAG="--dry-run"; \
	fi; \
	npm run dev -- flow --run "$$RUN" $$DRY_FLAG
