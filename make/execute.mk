# Make/execute.mk
# Execution flow targets

$(call register_target,verify-flow,VERIFY,Product wiring verification flow.,make verify-flow)
$(call register_target,orchestrator-validate,VERIFY,Run orchestrator flow then validate run artifacts.,make orchestrator-validate GOAL=\"...\" [MODE=planner|planner-architect])
$(call register_target,orchestrator-gated-validate,VERIFY,Run gated orchestrator flow that pauses for human override.,make orchestrator-gated-validate GOAL=\"...\" [CONTEXT=\"...\"])
$(call register_target,orchestrator-gated-resume,VERIFY,Resume a gated orchestrator run.,make orchestrator-gated-resume RUN=... DRY=0)
$(call register_target,orchestrator-gated-demo,VERIFY,Automated gated flow demo (pause, override, resume, validate).,make orchestrator-gated-demo GOAL=\"...\" [CONTEXT=\"...\"])

.PHONY: verify-flow
verify-flow:
	@set -eu; \
	echo "Running verify-flow..."; \
	node --import tsx scripts/smoke/verify-flow.ts

.PHONY: orchestrator-validate
orchestrator-validate:
	@set -eu; \
	if [ -z "${GOAL}" ]; then echo "GOAL is required. Usage: make orchestrator-validate GOAL=\"...\" [CONTEXT=\"...\"] [MODE=planner|planner-architect]"; exit 1; fi; \
	MODE_VALUE="$${MODE:-planner-architect}"; \
	case "$$MODE_VALUE" in \
		planner) SCRIPT="scripts/orchestrator/run-planner-with-policy.ts" ;; \
		planner-architect) SCRIPT="scripts/orchestrator/run-planner-architect-with-policy.ts" ;; \
		*) echo "Invalid MODE=$$MODE_VALUE. Use planner or planner-architect."; exit 1 ;; \
	esac; \
	LOG_FILE="$$(mktemp)"; \
	echo "Running $$SCRIPT ..."; \
	if [ -n "${CONTEXT}" ]; then \
		node --import tsx "$$SCRIPT" --goal "${GOAL}" --context "${CONTEXT}" >"$$LOG_FILE" 2>&1; \
	else \
		node --import tsx "$$SCRIPT" --goal "${GOAL}" >"$$LOG_FILE" 2>&1; \
	fi; \
	ORCH_STATUS=$$?; \
	if [ "$$ORCH_STATUS" -ne 0 ]; then cat "$$LOG_FILE"; echo "Orchestrator failed"; exit $$ORCH_STATUS; fi; \
	RUN_ID="$$(grep -m1 '^RUN_ID=' "$$LOG_FILE" | sed 's/^RUN_ID=//')"; \
	cat "$$LOG_FILE"; \
	if [ -z "$$RUN_ID" ]; then echo "RUN_ID not found in orchestrator output"; exit 1; fi; \
	echo "RUN_ID=$$RUN_ID"; \
	RUN_JSON="runs/$$RUN_ID/run.json"; \
	if [ ! -f "$$RUN_JSON" ]; then echo "Missing $$RUN_JSON"; exit 1; fi; \
	if command -v sha256sum >/dev/null 2>&1; then HASH_CMD="sha256sum"; else HASH_CMD="shasum -a 256"; fi; \
	HASH_BEFORE="$$( $$HASH_CMD "$$RUN_JSON" | awk '{print $$1}' )"; \
	cat "$$RUN_JSON"; \
	npm run dev -- status --run "$$RUN_ID"; \
	HASH_AFTER="$$( $$HASH_CMD "$$RUN_JSON" | awk '{print $$1}' )"; \
	if [ "$$HASH_BEFORE" != "$$HASH_AFTER" ]; then echo "run.json changed after status"; exit 1; fi; \
	npm run verify-run -- --run "$$RUN_ID"; \
	echo "orchestrator-validate OK for $$RUN_ID"

.PHONY: orchestrator-gated-validate
orchestrator-gated-validate:
	@set -eu; \
	if [ -z "${GOAL}" ]; then echo "GOAL is required. Usage: make orchestrator-gated-validate GOAL=\"...\" [CONTEXT=\"...\"]"; exit 1; fi; \
	CMD="node --import tsx scripts/orchestrator/run-gated-validate.ts --goal \"${GOAL}\""; \
	if [ -n "${CONTEXT}" ]; then CMD="$$CMD --context \"${CONTEXT}\""; fi; \
	# shellcheck disable=SC2086
	$$CMD; \
	STATUS=$$?; \
	exit $$STATUS

.PHONY: orchestrator-gated-resume
orchestrator-gated-resume:
	@set -eu; \
	if [ -z "${RUN}" ]; then echo "RUN is required. Usage: make orchestrator-gated-resume RUN=<run-id> [DRY=0]"; exit 1; fi; \
	$(MAKE) resume-run RUN="${RUN}" DRY="${DRY:-0}"

.PHONY: orchestrator-gated-demo
orchestrator-gated-demo:
	@set -eu; \
	if [ -z "${GOAL}" ]; then echo "GOAL is required. Usage: make orchestrator-gated-demo GOAL=\"...\" [CONTEXT=\"...\"]"; exit 1; fi; \
	LOG_FILE="$$(mktemp)"; \
	echo "Running gated validate (expected pause with exit 2)..."; \
	STATUS=0; \
	$(MAKE) orchestrator-gated-validate GOAL="${GOAL}" CONTEXT="${CONTEXT}" >"$$LOG_FILE" 2>&1 || STATUS=$$?; \
	STATUS=$${STATUS:-0}; \
	cat "$$LOG_FILE"; \
	if [ "$$STATUS" -ne 2 ]; then echo "Expected exit code 2 for gated pause, got $$STATUS"; exit $$STATUS; fi; \
	RUN_ID="$$(grep -m1 '^RUN_ID=' "$$LOG_FILE" | sed 's/^RUN_ID=//')"; \
	if [ -z "$$RUN_ID" ]; then echo "RUN_ID not found in output"; exit 1; fi; \
	echo "Paused run: $$RUN_ID"; \
	node --import tsx scripts/orchestrator/write-human-override.ts --run "$$RUN_ID" --step human_gate --action continue --reason "demo override"; \
	$(MAKE) orchestrator-gated-resume RUN="$$RUN_ID" DRY=0; \
	$(MAKE) validate-run RUN="$$RUN_ID"; \
	echo "orchestrator-gated-demo OK for $$RUN_ID"
