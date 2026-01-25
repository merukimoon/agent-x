.ONESHELL:

# agenticX Makefile
# See make/help.mk for the help system.
# Run `make help` to see available targets.

# Define default target
.DEFAULT_GOAL := help

# Include the Help registry first to ensure macros are available
include make/help.mk

# Include Topic modules
include make/dev.mk
include make/runs.mk
include make/agents.mk
include make/verify.mk
include make/planner.mk
include make/execute.mk

# (Any root-only extras can go here, but prefer modules)
