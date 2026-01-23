# Make/dev.mk
# Development and Verification targets

$(call register_target,typecheck,DEV,Run TypeScript type checking (via tsc).)
.PHONY: typecheck
typecheck:
	@echo "Running typecheck..."
	npm run typecheck

# Alias
.PHONY: check
check: typecheck

$(call register_target,test,DEV,Run unit tests (via vitest).)
.PHONY: test
test:
	@echo "Running tests..."
	npm run test

$(call register_target,verify-esm,DEV,Verify ESM compatibility (no require calls).)
.PHONY: verify-esm
verify-esm:
	npm run verify:esm

$(call register_target,verify-fast,DEV,Quick verification (typecheck + verify-esm, no tests).,make verify-fast)
.PHONY: verify-fast
verify-fast:
	@set -eu; \
	echo "Running verify-fast (typecheck, verify-esm)..."; \
	npm run typecheck; \
	npm run verify:esm

$(call register_target,verify,DEV,Full verification (verify-fast + tests).,make verify)
.PHONY: verify
verify:
	@set -eu; \
	$(MAKE) verify-fast; \
	echo "Running tests..."; \
	TMPDIR_RESOLVED="$${TMPDIR:-/tmp}"; \
	mkdir -p "$$TMPDIR_RESOLVED"; \
	TMPDIR="$$TMPDIR_RESOLVED" npm run test

$(call register_target,product-smoke,DEV,Product smoke flow (status + planner + agent + flow dry-run).,make product-smoke)
.PHONY: product-smoke
product-smoke:
	@set -eu; \
	echo "Running product smoke flow..."; \
	node --import tsx scripts/smoke/product-smoke.ts
