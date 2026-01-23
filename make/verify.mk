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
.PHONY: validate-run
validate-run:
	@set -eu; \
	if [ -z "${RUN}" ]; then echo "RUN is required. Usage: make validate-run RUN=<run-id>"; exit 1; fi; \
	echo "Validating run ${RUN}..."; \
	npm run verify-run -- --run "${RUN}"

.PHONY: verify-run
verify-run: validate-run
