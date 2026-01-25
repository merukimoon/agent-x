# Make/execute.mk
# Execution flow targets

$(call register_target,verify-flow,VERIFY,Product wiring verification flow.,make verify-flow)
$(call register_target,orchestrator-validate,VERIFY,Run orchestrator flow then validate run artifacts.,make orchestrator-validate GOAL=\"...\" CONTEXT=\"...\" [MODE=planner|planner-architect])
$(call register_target,orchestrator-gated-validate,VERIFY,Run gated orchestrator flow that pauses for human override.,make orchestrator-gated-validate GOAL=\"...\" [CONTEXT=\"...\"])
$(call register_target,orchestrator-gated-resume,VERIFY,Resume a gated orchestrator run.,make orchestrator-gated-resume RUN=<run-id> DRY=0)
$(call register_target,orchestrator-gated-demo,VERIFY,Automated gated flow demo (pause, override, resume, validate).,make orchestrator-gated-demo GOAL=\"...\" [CONTEXT=\"...\"])
$(call register_target,e2e-plan-flow,VERIFY,Run planner with fresh inputs and full verification gates.,make e2e-plan-flow GOAL=\"...\" CONTEXT=\"...\" [RUN=<run-id>])

.PHONY: verify-flow
verify-flow:
	@set -eu; \
	echo "Running verify-flow..."; \
	node --import tsx scripts/smoke/verify-flow.ts

.PHONY: orchestrator-validate
orchestrator-validate:
	@set -eu; \
	if [ -z "${GOAL}" ]; then echo "GOAL is required. Usage: make orchestrator-validate GOAL=\"...\" [CONTEXT=\"...\"] [MODE=planner|planner-architect]"; exit 1; fi; \
	MODE_VALUE="$${MODE:-planner-architect}"; \
	case "$$MODE_VALUE" in \
		planner) SCRIPT="scripts/orchestrator/run-planner-with-policy.ts" ;; \
		planner-architect) SCRIPT="scripts/orchestrator/run-planner-architect-with-policy.ts" ;; \
		*) echo "Invalid MODE=$$MODE_VALUE. Use planner or planner-architect."; exit 1 ;; \
	esac; \
	LOG_FILE="$$(mktemp)"; \
	echo "Running $$SCRIPT ..."; \
	if [ -n "${CONTEXT}" ]; then \
		node --import tsx "$$SCRIPT" --goal "${GOAL}" --context "${CONTEXT}" >"$$LOG_FILE" 2>&1; \
	else \
		node --import tsx "$$SCRIPT" --goal "${GOAL}" >"$$LOG_FILE" 2>&1; \
	fi; \
	ORCH_STATUS=$$?; \
	if [ "$$ORCH_STATUS" -ne 0 ]; then cat "$$LOG_FILE"; echo "Orchestrator failed"; exit $$ORCH_STATUS; fi; \
	RUN_ID="$$(grep -m1 '^RUN_ID=' "$$LOG_FILE" | sed 's/^RUN_ID=//')"; \
	cat "$$LOG_FILE"; \
	if [ -z "$$RUN_ID" ]; then echo "RUN_ID not found in orchestrator output"; exit 1; fi; \
	echo "RUN_ID=$$RUN_ID"; \
	RUN_JSON="runs/$$RUN_ID/run.json"; \
	if [ ! -f "$$RUN_JSON" ]; then echo "Missing $$RUN_JSON"; exit 1; fi; \
	if command -v sha256sum >/dev/null 2>&1; then HASH_CMD="sha256sum"; else HASH_CMD="shasum -a 256"; fi; \
	HASH_BEFORE="$$( $$HASH_CMD "$$RUN_JSON" | awk '{print $$1}' )"; \
	cat "$$RUN_JSON"; \
	$(PNPM) run dev status --run "$$RUN_ID"; \
	HASH_AFTER="$$( $$HASH_CMD "$$RUN_JSON" | awk '{print $$1}' )"; \
	if [ "$$HASH_BEFORE" != "$$HASH_AFTER" ]; then echo "run.json changed after status"; exit 1; fi; \
	$(PNPM) run verify-run --run "$$RUN_ID"; \
	echo "orchestrator-validate OK for $$RUN_ID"

.PHONY: orchestrator-gated-validate
orchestrator-gated-validate:
	@set -eu; \
	if [ -z "${GOAL}" ]; then echo "GOAL is required. Usage: make orchestrator-gated-validate GOAL=\"...\" [CONTEXT=\"...\"]"; exit 1; fi; \
	CMD="node --import tsx scripts/orchestrator/run-gated-validate.ts --goal \"${GOAL}\""; \
	if [ -n "${CONTEXT}" ]; then CMD="$$CMD --context \"${CONTEXT}\""; fi; \
	# shellcheck disable=SC2086
	$$CMD; \
	STATUS=$$?; \
	exit $$STATUS

.PHONY: orchestrator-gated-resume
orchestrator-gated-resume:
	@set -eu; \
	if [ -z "${RUN}" ]; then echo "RUN is required. Usage: make orchestrator-gated-resume RUN=<run-id> [DRY=0]"; exit 1; fi; \
	$(MAKE) resume-run RUN="${RUN}" DRY="$${DRY:-0}"

.PHONY: orchestrator-gated-demo
orchestrator-gated-demo:
	@set -eu; \
	if [ -z "${GOAL}" ]; then echo "GOAL is required. Usage: make orchestrator-gated-demo GOAL=\"...\" [CONTEXT=\"...\"]"; exit 1; fi; \
	LOG_FILE="$$(mktemp)"; \
	echo "Running gated validate (expected pause with exit 2)..."; \
	STATUS=0; \
	$(MAKE) orchestrator-gated-validate GOAL="${GOAL}" CONTEXT="${CONTEXT}" >"$$LOG_FILE" 2>&1 || STATUS=$$?; \
	STATUS=$${STATUS:-0}; \
	cat "$$LOG_FILE"; \
	if [ "$$STATUS" -ne 2 ]; then echo "Expected exit code 2 for gated pause, got $$STATUS"; exit $$STATUS; fi; \
	RUN_ID="$$(grep -m1 '^RUN_ID=' "$$LOG_FILE" | sed 's/^RUN_ID=//')"; \
	if [ -z "$$RUN_ID" ]; then echo "RUN_ID not found in output"; exit 1; fi; \
	echo "Paused run: $$RUN_ID"; \
	node --import tsx scripts/orchestrator/write-human-override.ts --run "$$RUN_ID" --step human_gate --action continue --reason "demo override"; \
	$(MAKE) orchestrator-gated-resume RUN="$$RUN_ID" DRY=0; \
	$(MAKE) validate-run RUN="$$RUN_ID"; \
	echo "orchestrator-gated-demo OK for $$RUN_ID"

.PHONY: e2e-plan-flow
e2e-plan-flow:
	@set -eu; \
	if [ -z "${GOAL}" ]; then echo "GOAL is required. Usage: make e2e-plan-flow GOAL=\"...\" CONTEXT=\"...\" [RUN=<run-id>]"; exit 1; fi; \
	RUN_ID="${RUN:-}"; \
	if [ -z "$$RUN_ID" ]; then \
		if command -v date >/dev/null 2>&1; then \
			RUN_ID="$$(TZ=UTC date +%Y-%m-%d_%H%M-e2e-plan)"; \
		else \
			RUN_ID="e2e-plan-$$RANDOM"; \
		fi; \
		echo "Creating run $$RUN_ID"; \
	fi; \
	RUN_DIR="runs/$$RUN_ID"; \
	if [ ! -d "$$RUN_DIR" ]; then \
		mkdir -p "$$RUN_DIR/inputs" "$$RUN_DIR/outputs/planner" "$$RUN_DIR/summary" "$$RUN_DIR/artifacts"; \
		node -e "const fs=require('fs');const p='$${RUN_DIR}/run.json'.replace('$${RUN_DIR}', process.argv[1]);const now=new Date().toISOString();const id=process.argv[2];fs.writeFileSync(p, JSON.stringify({id,run_id:id,flow:'',status:'in_progress',created_at_utc:now,started_at_utc:now,exit_code:null,error:null},null,2));" "$$RUN_DIR" "$$RUN_ID"; \
	fi; \
	mkdir -p "$$RUN_DIR/inputs" "$$RUN_DIR/outputs/planner"; \
	printf "%s\n" "${GOAL}" >"$$RUN_DIR/inputs/request.md"; \
	printf "%s\n" "${CONTEXT}" >"$$RUN_DIR/inputs/context.md"; \
	rm -f "$$RUN_DIR/plan.json" "$$RUN_DIR/outputs/planner/notes.md" "$$RUN_DIR/outputs/planner/result.json" "$$RUN_DIR/outputs/planner/status.json"; \
	echo "Running planner for $$RUN_ID (forces LLM invocation)..."; \
	$(PNPM) run dev planner --run "$$RUN_ID"; \
	if [ ! -f "$$RUN_DIR/outputs/planner/result.json" ]; then echo "planner result missing; planner did not run"; exit 1; fi; \
	echo "Writing minimal plan and summary for $$RUN_ID..."; \
	node -e 'const fs=require("fs");const path=require("path");const runDir=process.argv[1];const runId=process.argv[2];const now=new Date().toISOString();const plan={run_id:runId,created_at_utc:now,version:"0.1",flow_type:"planner-only",rationale:"planner e2e",signals:[],confidence:"low",steps:[{id:"planner",agent:"planner",depends_on:[],inputs:{request:"inputs/request.md",context:"inputs/context.md",prior_outputs:[]},outputs:{result:"outputs/planner/result.json",notes:"outputs/planner/notes.md",status:"outputs/planner/status.json"},status:"done",attempt:0,max_attempts:1,last_error:null,allow_skip:true}]};fs.mkdirSync(path.join(runDir,"summary"),{recursive:true});fs.writeFileSync(path.join(runDir,"plan.json"),JSON.stringify(plan,null,2));const summary="# Run summary\n\n- Run: "+runId+"\n- Flow: planner-only\n- Status: done\n- Created: "+now+"\n\n## Steps\n- planner (planner): done\n\n## Key artifacts\n- run.json\n- plan.json\n- planner: result=outputs/planner/result.json notes=outputs/planner/notes.md status=outputs/planner/status.json\n";fs.writeFileSync(path.join(runDir,"summary","final.md"),summary);const runPath=path.join(runDir,"run.json");let runJson={id:runId,run_id:runId,flow:"planner-only",status:"done",created_at_utc:now,started_at_utc:now,finished_at_utc:now,exit_code:0,error:null};if(fs.existsSync(runPath)){try{const current=JSON.parse(fs.readFileSync(runPath,"utf8"));runJson={...current,id:current.id||runId,run_id:current.run_id||runId,flow:"planner-only",status:"done",finished_at_utc:now,exit_code:0,error:null};}catch{}}fs.writeFileSync(runPath,JSON.stringify(runJson,null,2));' "$$RUN_DIR" "$$RUN_ID"; \
	echo "Running verification gates..."; \
	$(PNPM) run typecheck; \
	$(PNPM) run verify:esm; \
	TMPDIR_RESOLVED="$${TMPDIR:-/tmp}"; mkdir -p "$$TMPDIR_RESOLVED"; TMPDIR="$$TMPDIR_RESOLVED" $(PNPM) run test; \
	$(MAKE) verify-flow; \
	$(MAKE) validate-run RUN="$$RUN_ID"; \
	$(MAKE) orchestrator-validate GOAL="verify" CONTEXT="verify"; \
	$(MAKE) validate-run RUN="$$RUN_ID"; \
	$(PNPM) run verify-run --run "$$RUN_ID"; \
	echo "e2e-plan-flow OK. RUN=$$RUN_ID"
