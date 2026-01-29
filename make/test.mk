# make/test.mk
# Unit test targets

$(call register_target,test,TEST,Run unit tests.,make test)
.PHONY: test
test:
	@set -eu; \
	TMPDIR_RESOLVED="$${TEST_TMPDIR:-$${TMPDIR:-/tmp}}"; \
	mkdir -p "$$TMPDIR_RESOLVED"; \
	TMPDIR="$$TMPDIR_RESOLVED" $(PNPM) run test

$(call register_target,test-coverage,TEST,Run unit tests with coverage enforcement (85% threshold).,make test-coverage)
.PHONY: test-coverage
test-coverage:
	@set -eu; \
	TMPDIR_RESOLVED="$${TEST_TMPDIR:-$${TMPDIR:-/tmp}}"; \
	mkdir -p "$$TMPDIR_RESOLVED"; \
	TMPDIR="$$TMPDIR_RESOLVED" $(PNPM) run test:coverage

$(call register_target,test-watch,TEST,Run unit tests in watch mode.,make test-watch)
.PHONY: test-watch
test-watch:
	@$(PNPM) run test:watch
