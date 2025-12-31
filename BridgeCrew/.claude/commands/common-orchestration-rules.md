# Common Orchestration Rules

These rules apply to all workflows and exist to keep cost, quality, and context stable.

## Output Validation
- After each subagent completes, save output to `/tmp/agent-output.md`
- Validate before chaining:
  ```bash
  .claude/skills/orchestration/utilities/validate-agent-output.sh /tmp/agent-output.md <role>
  ```
- If validation fails, request a re-emit using the Agent Output Contract.

## Budget Guardrails (Optional)
## Budget Guardrails (Required)
- Always set a token budget at orchestration start.
- If the user does not specify one, default to `BUDGET_TOKENS=50000`.
- After each subagent call:
  1. Log estimated tokens:
     ```bash
     .claude/skills/state-management/utilities/add-metrics.sh "$STATE_FILE" "STEP_NAME" "MODEL_NAME" "ESTIMATED_TOKENS"
     ```
  2. Enforce the budget:
     ```bash
     .claude/skills/state-management/utilities/check-budget.sh "$STATE_FILE" "$BUDGET_TOKENS"
     ```
- If the budget is exceeded, stop and ask for guidance before continuing.

## Debugger Trigger
- If tests/build fail once, invoke `debugger` before retrying.

## Context Summarization
- After 6 subagent calls or when state exceeds ~300 lines, invoke `summarizer`
- Continue with the summary + recent 2-3 steps

## Cost-Sensitive Mode
- If the user asks for cheap/fast work:
  - Minimize subagent calls
  - Avoid parallelization unless required for scope or safety
  - Skip optional steps unless explicitly requested

## Delegation and Parallelization
- Delegate when specialized expertise is needed, scope spans >2 files, or requirements are ambiguous.
- Default to sequential execution. Parallelize only when the plan explicitly marks tasks as independent with no shared artifacts or ordering dependencies.

## Safety Stops
- Stop and ask before: new deps, migrations, new services, destructive commands
