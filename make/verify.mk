# Make/verify.mk
# Verification targets

$(call register_target,verify-fast,VERIFY,Quick verification (typecheck + verify-esm, no tests).,make verify-fast)
.PHONY: verify-fast
verify-fast:
	@set -eu; \
	echo "Running verify-fast (typecheck, verify-esm)..."; \
	npm run typecheck; \
	npm run verify:esm

$(call register_target,verify,VERIFY,Full verification (verify-fast + tests).,make verify)
.PHONY: verify
verify:
	@set -eu; \
	$(MAKE) verify-fast; \
	echo "Running tests..."; \
	TMPDIR_RESOLVED="$${TMPDIR:-/tmp}"; \
	mkdir -p "$$TMPDIR_RESOLVED"; \
	TMPDIR="$$TMPDIR_RESOLVED" npm run test; \

$(call register_target,validate-run,VERIFY,Validate run artifacts contract (requires RUN=<RUN>).,make validate-run RUN=<RUN>)
$(call register_target,verify-run,VERIFY,Alias for validate-run.,make verify-run RUN=<RUN>)
$(call register_target,verify-flows,VERIFY,Feature-level end-to-end flow verification (includes gated pause/resume).,make verify-flows)
$(call register_target,verify-plan-e2e,VERIFY,Planner-focused end-to-end verification (forces planner LLM invocation).,make verify-plan-e2e GOAL=\"...\" CONTEXT=\"...\" [RUN=<run-id>])
.PHONY: validate-run
validate-run:
	@set -eu; \
	if [ -z "${RUN}" ]; then echo "RUN is required. Usage: make validate-run RUN=<run-id>"; exit 1; fi; \
	echo "Validating run ${RUN}..."; \
	npm run verify-run -- --run "${RUN}"

.PHONY: verify-run
verify-run: validate-run

.PHONY: verify-flows
verify-flows:
	@set -eu; \
	LOG1="$$(mktemp)"; \
	set +e; $(MAKE) verify-flow >"$$LOG1" 2>&1; STATUS1=$$?; set -e; \
	cat "$$LOG1"; \
	if [ "$$STATUS1" -ne 0 ]; then echo "verify-flow failed"; exit $$STATUS1; fi; \
	RUN1="$$(grep -m1 'RUN=' "$$LOG1" | tail -n1 | sed 's/.*RUN=//')"; \
	if [ -z "$$RUN1" ]; then echo "RUN not found in verify-flow output"; exit 1; fi; \
	$(MAKE) validate-run RUN="$$RUN1"; \
	LOG2="$$(mktemp)"; \
	set +e; $(MAKE) orchestrator-validate GOAL="verify" CONTEXT="verify" >"$$LOG2" 2>&1; STATUS2=$$?; set -e; \
	cat "$$LOG2"; \
	if [ "$$STATUS2" -ne 0 ]; then echo "orchestrator-validate failed"; exit $$STATUS2; fi; \
	RUN2="$$(grep -m1 '^RUN_ID=' "$$LOG2" | sed 's/^RUN_ID=//')"; \
	if [ -z "$$RUN2" ]; then echo "RUN_ID not found for orchestrator-validate"; exit 1; fi; \
	$(MAKE) validate-run RUN="$$RUN2"; \
	LOG3="$$(mktemp)"; \
	set +e; $(MAKE) orchestrator-gated-validate GOAL="verify" CONTEXT="verify" >"$$LOG3" 2>&1; STATUS3=$$?; set -e; \
	cat "$$LOG3"; \
	if [ "$$STATUS3" -ne 2 ]; then echo "Expected exit code 2 for gated pause, got $$STATUS3"; exit $$STATUS3; fi; \
	RUN3="$$(grep -m1 '^RUN_ID=' "$$LOG3" | sed 's/^RUN_ID=//')"; \
	if [ -z "$$RUN3" ]; then echo "RUN_ID not found for gated validate"; exit 1; fi; \
	node --import tsx scripts/orchestrator/write-human-override.ts --run "$$RUN3" --step human_gate --action continue --reason "verify-flows override"; \
	$(MAKE) orchestrator-gated-resume RUN="$$RUN3" DRY=0; \
	$(MAKE) validate-run RUN="$$RUN3"; \
	echo "verify-flows complete. Runs: $$RUN1 $$RUN2 $$RUN3"

.PHONY: verify-plan-e2e
verify-plan-e2e:
	@set -eu; \
	if [ -z "${GOAL}" ] || [ -z "${CONTEXT}" ]; then echo "GOAL and CONTEXT are required. Usage: make verify-plan-e2e GOAL=\"...\" CONTEXT=\"...\" [RUN=<run-id>]"; exit 1; fi; \
	$(MAKE) e2e-plan-flow GOAL="${GOAL}" CONTEXT="${CONTEXT}" RUN="${RUN}"
