# Make/agents.mk
# Agent Execution targets

$(call register_target,agent,AGENTS,Run a single agent for a run.,make agent AGENT=coordinator RUN=<run-id> DRY=1)
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
	$(PNPM) run dev agent "$$AGENT" --run "$$RUN" $$DRY_FLAG

$(call register_target,flow,AGENTS,Execute the full plan/flow for a run.,make flow RUN=<run-id> DRY=1)
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
	$(PNPM) run dev flow --run "$$RUN" $$DRY_FLAG

$(call register_target,resume-run,AGENTS,Alias for flow to resume a run.,make resume-run RUN=<run-id> DRY=1)
.PHONY: resume-run
resume-run: flow

$(call register_target,run-step,AGENTS,Execute a single plan step and stop.,make run-step RUN=<run-id> STEP=<id> DRY=1)
.PHONY: run-step
run-step:
	@set -eu; \
	RUN="$${RUN:-}"; STEP="$${STEP:-}"; DRY="$${DRY:-1}"; \
	if [ -z "$$RUN" ] || [ -z "$$STEP" ]; then echo "RUN and STEP are required"; exit 2; fi; \
	DRY_FLAG=""; if [ "$$DRY" != "0" ]; then DRY_FLAG="--dry-run"; fi; \
	$(PNPM) run dev flow --run "$$RUN" --step "$$STEP" $$DRY_FLAG; \
	$(PNPM) run dev verify-run --run "$$RUN"

$(call register_target,run-from,AGENTS,Execute plan starting from a step and downstream.,make run-from RUN=<run-id> STEP=<id> DRY=1)
.PHONY: run-from
run-from:
	@set -eu; \
	RUN="$${RUN:-}"; STEP="$${STEP:-}"; DRY="$${DRY:-1}"; \
	if [ -z "$$RUN" ] || [ -z "$$STEP" ]; then echo "RUN and STEP are required"; exit 2; fi; \
	DRY_FLAG=""; if [ "$$DRY" != "0" ]; then DRY_FLAG="--dry-run"; fi; \
	$(PNPM) run dev flow --run "$$RUN" --from "$$STEP" $$DRY_FLAG; \
	$(PNPM) run dev verify-run --run "$$RUN"

$(call register_target,run-until,AGENTS,Execute plan until a step then stop.,make run-until RUN=<run-id> STEP=<id> DRY=1)
.PHONY: run-until
run-until:
	@set -eu; \
	RUN="$${RUN:-}"; STEP="$${STEP:-}"; DRY="$${DRY:-1}"; \
	if [ -z "$$RUN" ] || [ -z "$$STEP" ]; then echo "RUN and STEP are required"; exit 2; fi; \
	DRY_FLAG=""; if [ "$$DRY" != "0" ]; then DRY_FLAG="--dry-run"; fi; \
	$(PNPM) run dev flow --run "$$RUN" --until "$$STEP" $$DRY_FLAG; \
	$(PNPM) run dev verify-run --run "$$RUN"
