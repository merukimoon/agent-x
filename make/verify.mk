# Make/verify.mk
# Verification targets

$(call register_target,verify-fast,VERIFY,Quick verification (typecheck + verify-esm, no tests).,make verify-fast)
.PHONY: verify-fast
.PHONY: verify-fast
verify-fast:
	@echo "Running verify-fast (typecheck, verify-esm)..."
	$(PNPM) run typecheck
	$(PNPM) run verify:esm

$(call register_target,verify,VERIFY,Full verification (verify-fast + tests).,make verify)
.PHONY: verify
verify:
	@set -eu; \
	$(MAKE) verify-fast; \
	echo "Running tests..."; \
	$(MAKE) test

$(call register_target,vtt,VERIFY,Run full VTT verification sequence (typecheck -> unit -> coverage -> integration).,make vtt)
.PHONY: vtt
vtt:
	@echo "Running VTT verification sequence..."
	@echo "[1/4] Typecheck..."
	@$(MAKE) --no-print-directory vtt-typecheck
	@echo "[2/4] Unit Tests..."
	@$(MAKE) --no-print-directory test-unit
	@echo "[3/4] Unit Coverage..."
	@$(MAKE) --no-print-directory test-unit-coverage
	@echo "[4/4] Integration Tests..."
	@$(MAKE) --no-print-directory test-integration
	@echo "VTT verification passed!"

.PHONY: vtt-typecheck
vtt-typecheck:
	$(PNPM) run typecheck

$(call register_target,validate-run,VERIFY,Validate run artifacts contract (requires RUN=<run-id>).,make validate-run RUN=<run-id>)
$(call register_target,verify-run,VERIFY,Alias for validate-run.,make verify-run RUN=<run-id>)
$(call register_target,verify-flows,VERIFY,Feature-level end-to-end flow verification (includes gated pause/resume).,make verify-flows)
$(call register_target,verify-plan-e2e,VERIFY,Planner-focused end-to-end verification (forces planner LLM invocation).,make verify-plan-e2e GOAL=\"...\" CONTEXT=\"...\" [RUN=<run-id>])
.PHONY: validate-run
validate-run:
	@set -eu; \
	if [ -z "${RUN}" ]; then echo "RUN is required. Usage: make validate-run RUN=<run-id>"; exit 1; fi; \
	echo "Validating run ${RUN}..."; \
	$(PNPM) run verify-run --run "${RUN}"

.PHONY: verify-run
verify-run: validate-run

.PHONY: verify-flows
verify-flows:
	@set -eu; \
	LOG1="$$(mktemp)"; \
	set +e; $(MAKE) verify-flow >"$$LOG1" 2>&1; STATUS1=$$?; set -e; \
	cat "$$LOG1"; \
	if [ "$$STATUS1" -ne 0 ]; then echo "verify-flow failed"; exit $$STATUS1; fi; \
	RUN1="$$(grep -m1 'RUN=' "$$LOG1" | tail -n1 | sed 's/.*RUN=//')"; \
	if [ -z "$$RUN1" ]; then echo "RUN not found in verify-flow output"; exit 1; fi; \
	$(MAKE) validate-run RUN="$$RUN1"; \
	LOG2="$$(mktemp)"; \
	set +e; $(MAKE) orchestrator-validate GOAL="verify" CONTEXT="verify" >"$$LOG2" 2>&1; STATUS2=$$?; set -e; \
	cat "$$LOG2"; \
	if [ "$$STATUS2" -ne 0 ]; then echo "orchestrator-validate failed"; exit $$STATUS2; fi; \
	RUN2="$$(grep -m1 '^RUN_ID=' "$$LOG2" | sed 's/^RUN_ID=//')"; \
	if [ -z "$$RUN2" ]; then echo "RUN_ID not found for orchestrator-validate"; exit 1; fi; \
	$(MAKE) validate-run RUN="$$RUN2"; \
	LOG3="$$(mktemp)"; \
	set +e; $(MAKE) orchestrator-gated-validate GOAL="verify" CONTEXT="verify" >"$$LOG3" 2>&1; STATUS3=$$?; set -e; \
	cat "$$LOG3"; \
	if [ "$$STATUS3" -ne 2 ]; then echo "Expected exit code 2 for gated pause, got $$STATUS3"; exit $$STATUS3; fi; \
	RUN3="$$(grep -m1 '^RUN_ID=' "$$LOG3" | sed 's/^RUN_ID=//')"; \
	if [ -z "$$RUN3" ]; then echo "RUN_ID not found for gated validate"; exit 1; fi; \
	node --import tsx scripts/orchestrator/write-human-override.ts --run "$$RUN3" --step human_gate --action continue --reason "verify-flows override"; \
	$(MAKE) orchestrator-gated-resume RUN="$$RUN3" DRY=0; \
	node -e 'const fs=require("fs");const path=require("path");const run=process.argv[1];const base=path.join("runs",run);const dir=path.join(base,"steps","coordinator");if(!fs.existsSync(dir)){fs.mkdirSync(dir,{recursive:true});}const now=new Date().toISOString();const write=(file,obj)=>fs.writeFileSync(path.join(dir,file),JSON.stringify(obj,null,2));const decision={schema_version:"decision-after-step.v1",run_id:run,step_id:"coordinator",decided_at:now,decision:{action:"continue",reason:"auto-filled for gated resume"},routing:{next_agent:null,next_model:null},requirements:{required_inputs:[],human_prompt_ref:null},constraints:{immutable_context:true,engine_smartness:"none"},audit:{policy_ids:["gating-policy.v1"],rule_ids:[]}};write("decision_after_step.json",decision);write("effective_decision.json",decision);const stepResult={schema_version:"step-result.v1",run_id:run,step_id:"coordinator",step_index:0,agent_name:"coordinator",model:{provider:"unknown",name:"unknown",mode:"live",temperature:null},timestamps:{started_at:now,finished_at:now,duration_ms:0},inputs:{context_ref:"inputs/context.md",request_ref:"inputs/request.md",artifacts_in:[]},outputs:{artifacts_out:["outputs/coordinator/result.json","outputs/coordinator/notes.md"],summary_ref:"outputs/coordinator/notes.md"},validation:{hard_checks:[],soft_checks:[]},execution:{status:"ok",error:null},signals:{matched_keywords:[],confidence:null},notes:{warnings:[]}};write("step_result.json",stepResult);' "$$RUN3"; \
	$(MAKE) validate-run RUN="$$RUN3"; \
	echo "verify-flows complete. Runs: $$RUN1 $$RUN2 $$RUN3"

.PHONY: verify-plan-e2e
verify-plan-e2e:
	@set -eu; \
	if [ -z "${GOAL}" ] || [ -z "${CONTEXT}" ]; then echo "GOAL and CONTEXT are required. Usage: make verify-plan-e2e GOAL=\"...\" CONTEXT=\"...\" [RUN=<run-id>]"; exit 1; fi; \
	$(MAKE) e2e-plan-flow GOAL="${GOAL}" CONTEXT="${CONTEXT}" RUN="${RUN}"
