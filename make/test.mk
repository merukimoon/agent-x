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

$(call register_target,test,TEST,Run default unit tests.,pnpm run test)
$(call register_target,test-watch,TEST,Run unit tests in watch mode.,pnpm run test:watch)
$(call register_target,test-unit,TEST,Explicitly run unit tests.,pnpm run test:unit)
$(call register_target,test-integration,TEST,Run integration tests.,pnpm run test:integration)
$(call register_target,test-integration-watch,TEST,Run integration tests in watch mode.,pnpm run test:integration:watch)
$(call register_target,test-mcp,TEST,Run MCP unit tests.,pnpm run test:unit --dir packages/mcp/src/__tests__)
$(call register_target,test-cli,TEST,Run CLI unit tests.,pnpm run test:unit --dir packages/cli/src/__tests__)
$(call register_target,test-core,TEST,Run Core unit tests.,pnpm run test:unit --dir packages/core/src/__tests__)
$(call register_target,test-mcp-protections,TEST,Run MCP protections suite.,pnpm run test:mcp-protections)
$(call register_target,test-mcp-stress,TEST,Run MCP stress suite.,pnpm run test:mcp-stress)

.PHONY: test test-watch test-unit test-integration test-integration-watch
.PHONY: test-mcp test-cli test-core test-mcp-protections test-mcp-stress

test:
	@echo "Running unit tests via pnpm..."
	$(PNPM) run test $(if $(TEST_ARGS),-- $(TEST_ARGS))

test-watch:
	$(PNPM) run test:watch $(if $(TEST_ARGS),-- $(TEST_ARGS))

test-unit:
	$(PNPM) run test:unit $(if $(TEST_ARGS),-- $(TEST_ARGS))

test-integration:
	$(PNPM) run test:integration $(if $(TEST_ARGS),-- $(TEST_ARGS))

test-integration-watch:
	$(PNPM) run test:integration:watch $(if $(TEST_ARGS),-- $(TEST_ARGS))

test-mcp:
	$(PNPM) run test:unit --dir packages/mcp/src/__tests__ $(if $(TEST_ARGS),-- $(TEST_ARGS))

test-cli:
	$(PNPM) run test:unit --dir packages/cli/src/__tests__ $(if $(TEST_ARGS),-- $(TEST_ARGS))

test-core:
	$(PNPM) run test:unit --dir packages/core/src/__tests__ $(if $(TEST_ARGS),-- $(TEST_ARGS))

test-mcp-protections:
	$(PNPM) run test:mcp-protections $(if $(TEST_ARGS),-- $(TEST_ARGS))

test-mcp-stress:
	$(PNPM) run test:mcp-stress $(if $(TEST_ARGS),-- $(TEST_ARGS))
