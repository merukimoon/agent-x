# make/test.mk
# Unit and integration test targets

# Legacy target - runs all tests (unit + integration)
$(call register_target,test,TEST,Run all tests (unit + integration).,make test)
.PHONY: test
test:
	@set -eu; \
	TMPDIR_RESOLVED="$${TEST_TMPDIR:-$${TMPDIR:-/tmp}}"; \
	mkdir -p "$$TMPDIR_RESOLVED"; \
	TMPDIR="$$TMPDIR_RESOLVED" $(PNPM) run test:all

# Unit tests only (packages/**/src/__tests__/**)
$(call register_target,test-unit,TEST,Run unit tests only (deterministic isolated tests in packages/).,make test-unit)
.PHONY: test-unit
test-unit:
	@set -eu; \
	TMPDIR_RESOLVED="$${TEST_TMPDIR:-$${TMPDIR:-/tmp}}"; \
	mkdir -p "$$TMPDIR_RESOLVED"; \
	TMPDIR="$$TMPDIR_RESOLVED" $(PNPM) run test:unit

# Unit tests with coverage enforcement (thresholds: 80/75/80/80)
$(call register_target,test-unit-coverage,TEST,Run unit tests with enforced coverage (80% lines 75% branches).,make test-unit-coverage)
.PHONY: test-unit-coverage
test-unit-coverage:
	@set -eu; \
	TMPDIR_RESOLVED="$${TEST_TMPDIR:-$${TMPDIR:-/tmp}}"; \
	mkdir -p "$$TMPDIR_RESOLVED"; \
	TMPDIR="$$TMPDIR_RESOLVED" $(PNPM) run test:unit:coverage

# Integration tests only (tests/**)
$(call register_target,test-integration,TEST,Run integration tests only (e2e workflows in tests/).,make test-integration)
.PHONY: test-integration
test-integration:
	@set -eu; \
	TMPDIR_RESOLVED="$${TEST_TMPDIR:-$${TMPDIR:-/tmp}}"; \
	mkdir -p "$$TMPDIR_RESOLVED"; \
	TMPDIR="$$TMPDIR_RESOLVED" $(PNPM) run test:integration

# Legacy coverage target - now points to unit coverage
$(call register_target,test-coverage,TEST,Run unit tests with coverage (alias for test-unit-coverage).,make test-coverage)
.PHONY: test-coverage
test-coverage: test-unit-coverage

# Test watch mode
$(call register_target,test-watch,TEST,Run all tests in watch mode.,make test-watch)
.PHONY: test-watch
test-watch:
	@$(PNPM) run test:watch

