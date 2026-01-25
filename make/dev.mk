# Make/dev.mk
# Development and Verification targets

$(call register_target,typecheck,DEV,Run TypeScript type checking (via tsc).,make typecheck)
.PHONY: typecheck
typecheck:
	@echo "Running typecheck..."
	$(PNPM) run typecheck

# Alias
.PHONY: check
check: typecheck

$(call register_target,test,DEV,Run unit tests (via vitest).,make test TEST_TMPDIR=/tmp)
.PHONY: test
test:
	@echo "Running tests..."
	@set -eu; \
	if [ -n "${TEST_TMPDIR}" ]; then \
		TMPDIR="${TEST_TMPDIR}" MAKEFLAGS= $(PNPM) run test; \
	else \
		MAKEFLAGS= $(PNPM) run test; \
	fi

$(call register_target,verify-esm,DEV,Verify ESM compatibility (no require calls).,make verify-esm)
.PHONY: verify-esm
verify-esm:
	$(PNPM) run verify:esm

$(call register_target,clean-runs,DEV,Remove old run folders under runs/ (opt-in).,make clean-runs CLEAN_RUNS=1 [RUNS_KEEP=5])
.PHONY: clean-runs
clean-runs:
	@set -eu; \
	if [ "${CLEAN_RUNS}" != "1" ]; then echo "CLEAN_RUNS=1 is required to run clean-runs"; exit 1; fi; \
	if [ ! -d "runs" ]; then echo "runs/ does not exist. Nothing to clean."; exit 0; fi; \
	if [ -n "${RUNS_KEEP}" ]; then \
		case "${RUNS_KEEP}" in \
			*[!0-9]*) echo "RUNS_KEEP must be a positive integer"; exit 1 ;; \
		esac; \
		if [ "${RUNS_KEEP}" -le 0 ]; then echo "RUNS_KEEP must be greater than 0"; exit 1; fi; \
	fi; \
	# Using name sort because run directories embed timestamps in names.
		if [ -n "${RUNS_KEEP}" ]; then \
		echo "Cleaning runs, keeping last ${RUNS_KEEP}..."; \
		LIST="$$(cd runs && ls -1dt */ 2>/dev/null | sed 's:/*$$::')"; \
		if [ -z "$$LIST" ]; then echo "Nothing to delete; runs/ is empty"; exit 0; fi; \
		COUNT="$$(printf "%s\n" "$$LIST" | wc -l | tr -d ' ')"; \
		if [ "$$COUNT" -le "${RUNS_KEEP}" ]; then echo "Nothing to delete; $$COUNT <= ${RUNS_KEEP}"; exit 0; fi; \
		DELETE_LIST="$$(printf "%s\n" "$$LIST" | tail -n +$$((RUNS_KEEP+1)))"; \
		printf "%s\n" "$$DELETE_LIST" | while read -r d; do [ -n "$$d" ] && rm -rf "runs/$$d"; done; \
	else \
		echo "Cleaning all runs..."; \
		find runs -mindepth 1 -maxdepth 1 -type d -exec rm -rf {} +; \
	fi
