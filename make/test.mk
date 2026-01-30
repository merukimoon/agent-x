# make/test.mk
# Canonical test entrypoints (internal developer tooling).
# Requires: PNPM variable set in your repo (or defaults below).

PNPM ?= pnpm

.PHONY: test test-watch \
        test-unit test-unit-coverage test-integration test-stress \
        test-mcp-protections test-mcp-stress \
        test-cli-unit test-core-unit test-mcp-unit \
        test-cli-integration test-core-integration test-mcp-integration \
        test-unit-coverage-cli test-unit-coverage-core test-unit-coverage-mcp \
        test-list test-help

# Optional: allow passing extra args to vitest (e.g. TEST_ARGS="--reporter=verbose")
# Optional: allow setting TMPDIR in a portable way (e.g. TEST_TMPDIR=/tmp)
ifdef TEST_TMPDIR
export TMPDIR := $(TEST_TMPDIR)
endif

# -------------------------
# Top-level suites
# -------------------------

test:
	$(PNPM) run test

test-watch:
	$(PNPM) run test:watch

test-unit:
	$(PNPM) run test:unit

test-unit-coverage:
	$(PNPM) run test:unit:coverage

test-integration:
	$(PNPM) run test:integration

# If you add `test:stress` script, wire it here. Otherwise keep MCP stress as dedicated target.
test-stress:
	$(PNPM) run test:stress

# -------------------------
# MCP dedicated runners
# -------------------------

test-mcp-protections:
	$(PNPM) run test:mcp-protections

test-mcp-stress:
	$(PNPM) run test:mcp-stress

# -------------------------
# Per-package (unit)
# These assume your vitest.unit.config.js supports running against paths.
# They use -- to forward filters to vitest.
# -------------------------

test-mcp-unit:
	$(PNPM) run test:unit -- packages/mcp/src/__tests__/unit

test-cli-unit:
	$(PNPM) run test:unit -- packages/cli/src/__tests__/unit

test-core-unit:
	$(PNPM) run test:unit -- packages/core/src/__tests__/unit

# Per-package unit with coverage (keeps the same config, narrows test selection by path)
test-unit-coverage-mcp:
	$(PNPM) run test:unit:coverage -- packages/mcp/src/__tests__/unit

test-unit-coverage-cli:
	$(PNPM) run test:unit:coverage -- packages/cli/src/__tests__/unit

test-unit-coverage-core:
	$(PNPM) run test:unit:coverage -- packages/core/src/__tests__/unit

# -------------------------
# Per-package (integration)
# -------------------------

test-mcp-integration:
	$(PNPM) run test:integration -- packages/mcp/src/__tests__/integration

test-cli-integration:
	$(PNPM) run test:integration -- packages/cli/src/__tests__/integration

test-core-integration:
	$(PNPM) run test:integration -- packages/core/src/__tests__/integration

# -------------------------
# Utilities
# -------------------------

# List discovered tests for a given suite:
# make test-list TEST_SUITE=unit|integration|stress TEST_ARGS="--list"
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
	$(PNPM) exec vitest --config vitest.stress.config.js $(TEST_ARGS)
else
	@echo "Unknown TEST_SUITE=$(TEST_SUITE). Expected unit|integration|stress"
	@exit 1
endif
