# Make/runs.mk
# Run management targets

$(call register_target,run-new,RUNS,Create a new run directory with timestamp.,make run-new NAME="docs-pr-audit")
.PHONY: run-new
run-new:
	@set -eu; \
	NAME="$${NAME:-}"; \
	node --import tsx scripts/scaffold-run.ts

$(call register_target,run-tree,RUNS,List files in a run directory.,make run-tree RUN=\"2026-01-17_0930-docs-pr-audit\")
.PHONY: run-tree
run-tree:
	@set -eu; \
	RUN="$${RUN:-}"; \
	if [ -z "$$RUN" ]; then \
		echo "ERROR: RUN is required. Example: make run-tree RUN=\"2026-01-17_0930-docs-pr-audit\""; \
		exit 2; \
	fi; \
	RUN_DIR="runs/$$RUN"; \
	if [ ! -d "$$RUN_DIR" ]; then \
		echo "ERROR: run directory not found: $$RUN_DIR"; \
		exit 2; \
	fi; \
	if command -v tree >/dev/null 2>&1; then \
		tree -a "$$RUN_DIR"; \
	else \
		echo "tree not found; using find"; \
		find "$$RUN_DIR" -print; \
	fi

$(call register_target,run-status,RUNS,Check status of a run/plan.,make run-status RUN=\"2026-01-18_1124-pr-docs\")
.PHONY: run-status
run-status:
	@set -eu; \
	RUN="$${RUN:-}"; \
	if [ -n "$$RUN" ]; then \
		npm run dev -- status --run "$$RUN"; \
	else \
		npm run dev -- status; \
	fi
