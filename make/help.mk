# Make/help.mk
# A simple, portable Registry-based Help system.

HELP_TOPICS :=

# Macro: register_target
# Arguments:
# 1: Target Name
# 2: Topic Name (e.g. DEV, RUNS, AGENTS)
# 3: Description
# 4: Usage Example (optional)
define register_target
$(eval HELP_TOPICS += $(2))
$(eval TARGETS_$(2) += $(1))
$(eval DESC_$(1) := $(3))
$(eval USAGE_$(1) := $(4))
endef

.PHONY: help
help:
	@:
	$(info =================================================================)
	$(info  agenticX Makefile)
	$(info =================================================================)
	$(foreach topic,$(sort $(HELP_TOPICS)), \
		$(info ) \
		$(info [$(topic)]) \
		$(foreach target,$(TARGETS_$(topic)), \
			$(info $(shell node -e "console.log('$(target)'.padEnd(25) + '$(DESC_$(target))')")) \
			$(if $(USAGE_$(target)), $(info $(shell node -e "console.log(''.padEnd(27) + 'Example: $(USAGE_$(target))')"))) \
		) \
	)
	$(info )
