.ONESHELL:

# agentsquad-framework Makefile
# See Make/help.mk for the help system.
# Run `make help` to see available targets.

# Define default target
.DEFAULT_GOAL := help

# Include the Help registry first to ensure macros are available
include Make/help.mk

# Include Topic modules
include Make/dev.mk
include Make/runs.mk
include Make/agents.mk
include Make/verify.mk
include Make/planner.mk

# (Any root-only extras can go here, but prefer modules)
