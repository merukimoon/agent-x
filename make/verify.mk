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
	TMPDIR="$$TMPDIR_RESOLVED" npm run test

$(call register_target,verify-flow,VERIFY,Product wiring verification flow.,make verify-flow)
.PHONY: verify-flow
verify-flow:
	@set -eu; \
	echo "Running verify-flow..."; \
	node --import tsx scripts/smoke/verify-flow.ts
