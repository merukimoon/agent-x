# make/test.mk
# Unit Test Targets
#
# Conventions:
# - All test invocations use the canonical command: pnpm run test
# - Support TEST_TMPDIR for tmp directory override (portable via Make export)
# - Support TEST_ARGS for passing additional arguments to test runner
# - No direct vitest invocations
# - Windows-compatible (no bash-only constructs)

# Handle TEST_TMPDIR mapping to TMPDIR using Make logic
ifdef TEST_TMPDIR
export TMPDIR := $(TEST_TMPDIR)
endif

$(call register_target,test,TEST,Run unit tests via pnpm run test.,make test)
$(call register_target,test,TEST,  With custom tmp dir:,make test TEST_TMPDIR=/tmp)
$(call register_target,test,TEST,  With extra args:,make test TEST_ARGS="packages/mcp/src/__tests__")
$(call register_target,test,TEST,  With stress suite:,pnpm run test:mcp-stress)
$(call register_target,test,TEST,  With reporter:,make test TEST_ARGS="--reporter=verbose")
.PHONY: test
test:
	@echo "Running tests..."
ifdef TEST_ARGS
	$(PNPM) run test -- $(TEST_ARGS)
else
	$(PNPM) run test
endif
