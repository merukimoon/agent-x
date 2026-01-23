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
	MAKEFLAGS= npm run test

$(call register_target,verify-esm,DEV,Verify ESM compatibility (no require calls).)
.PHONY: verify-esm
verify-esm:
	npm run verify:esm
