# make/test.mk
# Canonical test entrypoints (internal developer tooling).
# Requires: PNPM variable set in your repo (or defaults below).

PNPM ?= pnpm
TEST_ARGS ?=

.PHONY: test test-watch \
        test-unit test-unit-coverage test-integration test-stress \
        test-mcp-protections test-mcp-stress \
        test-cli-unit test-core-unit test-mcp-unit \
        test-cli-integration test-core-integration test-mcp-integration \
        test-unit-coverage-cli test-unit-coverage-core test-unit-coverage-mcp \
        test-list

# Optional: allow setting TMPDIR in a portable way (e.g. TEST_TMPDIR=/tmp)
ifdef TEST_TMPDIR
export TMPDIR := $(TEST_TMPDIR)
endif

define run_pnpm_test
$(if $(strip $(2) $(TEST_ARGS)), \
    $(PNPM) run $(1) -- $(strip $(2) $(TEST_ARGS)), \
    $(PNPM) run $(1))
endef

# -------------------------
# Top-level suites
# -------------------------

$(call register_target,test,TEST,Run the full Vitest suite (watching everything).,make test TEST_ARGS=--reporter=dot TEST_TMPDIR=/tmp)
test:
	$(call run_pnpm_test,test,)

$(call register_target,test-watch,TEST,Launch Vitest in watch mode for fast iteration.,make test-watch TEST_ARGS=--reporter=verbose)
test-watch:
	$(call run_pnpm_test,test:watch,)

$(call register_target,test-unit,TEST,Run the deterministic unit suite with Vitest.,make test-unit TEST_ARGS=--reporter=dot)
test-unit:
	$(call run_pnpm_test,test:unit,)

$(call register_target,test-unit-coverage,TEST,Run the unit suite with coverage reporting.,make test-unit-coverage TEST_TMPDIR=/tmp)
test-unit-coverage:
	$(call run_pnpm_test,test:unit:coverage,)

$(call register_target,test-integration,TEST,Run the isolation-focused integration suite.,make test-integration TEST_TMPDIR=/tmp)
test-integration:
	$(call run_pnpm_test,test:integration,)

$(call register_target,test-stress,TEST,Run the MCP stress suite (falls back to the dedicated stress config).,make test-stress TEST_TMPDIR=/tmp)
test-stress:
	$(call run_pnpm_test,test:mcp-stress,)

# -------------------------
# MCP dedicated runners
# -------------------------

$(call register_target,test-mcp-protections,TEST,Run MCP-specific protection-focused suites.,make test-mcp-protections)
test-mcp-protections:
	$(call run_pnpm_test,test:mcp-protections,)

$(call register_target,test-mcp-stress,TEST,Run the MCP stress tests via their dedicated script.,make test-mcp-stress)
test-mcp-stress:
	$(call run_pnpm_test,test:mcp-stress,)

# -------------------------
# Per-package (unit)
# -------------------------

$(call register_target,test-mcp-unit,TEST,Run only the MCP unit tests.,make test-mcp-unit)
test-mcp-unit:
	$(call run_pnpm_test,test:unit,packages/mcp/src/__tests__/unit)

$(call register_target,test-cli-unit,TEST,Run only the CLI unit tests.,make test-cli-unit)
test-cli-unit:
	$(call run_pnpm_test,test:unit,packages/cli/src/__tests__/unit)

$(call register_target,test-core-unit,TEST,Run only the core unit tests.,make test-core-unit)
test-core-unit:
	$(call run_pnpm_test,test:unit,packages/core/src/__tests__/unit)

# Per-package unit with coverage
$(call register_target,test-unit-coverage-mcp,TEST,Run only MCP unit tests with coverage.,make test-unit-coverage-mcp TEST_ARGS=--reporter=dot)
test-unit-coverage-mcp:
	$(call run_pnpm_test,test:unit:coverage,packages/mcp/src/__tests__/unit)

$(call register_target,test-unit-coverage-cli,TEST,Run only CLI unit tests with coverage.,make test-unit-coverage-cli)
test-unit-coverage-cli:
	$(call run_pnpm_test,test:unit:coverage,packages/cli/src/__tests__/unit)

$(call register_target,test-unit-coverage-core,TEST,Run only core unit tests with coverage.,make test-unit-coverage-core)
test-unit-coverage-core:
	$(call run_pnpm_test,test:unit:coverage,packages/core/src/__tests__/unit)

# -------------------------
# Per-package (integration)
# -------------------------

$(call register_target,test-mcp-integration,TEST,Run only the MCP integration tests.,make test-mcp-integration TEST_TMPDIR=/tmp)
test-mcp-integration:
	$(call run_pnpm_test,test:integration,packages/mcp/src/__tests__/integration)

$(call register_target,test-cli-integration,TEST,Run only the CLI integration tests.,make test-cli-integration TEST_TMPDIR=/tmp)
test-cli-integration:
	$(call run_pnpm_test,test:integration,packages/cli/src/__tests__/integration)

$(call register_target,test-core-integration,TEST,Run only the core integration tests.,make test-core-integration TEST_TMPDIR=/tmp)
test-core-integration:
	$(call run_pnpm_test,test:integration,packages/core/src/__tests__/integration)

# -------------------------
# Utilities
# -------------------------

$(call register_target,test-list,TEST,List discovered tests for the requested suite.,make test-list TEST_SUITE=unit TEST_ARGS=--list)
test-list:
ifndef TEST_SUITE
	@echo "Usage: make test-list TEST_SUITE=unit|integration|stress [TEST_ARGS=\"--list\"]"
	@exit 1
endif
ifeq ($(TEST_SUITE),unit)
	$(PNPM) exec vitest --config vitest.unit.config.js $(TEST_ARGS)
else ifeq ($(TEST_SUITE),integration)
	$(PNPM) exec vitest --config vitest.integration.config.js $(TEST_ARGS)
else ifeq ($(TEST_SUITE),stress)
	$(PNPM) exec vitest --config vitest.mcp-stress.config.js $(TEST_ARGS)
else
	@echo "Unknown TEST_SUITE=$(TEST_SUITE). Expected unit|integration|stress"
	@exit 1
endif
