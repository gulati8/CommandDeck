# Operator Quick Start

This is a short handbook for running the orchestrator with minimal overhead.

## Daily Use
- Prefer intent-based requests; slash commands are optional.
- Use `/project:quickfix` for tiny changes (1-2 files).
- For larger work, start with a clear goal and acceptance criteria.
- Apply shared policy in `common-orchestration-rules.md`.
- Prefer clear structure and naming over comments; add comments/docs only for complex decisions.

## Cost-Sensitive Mode
- If the user asks for a cheap/fast run, set **cost-sensitive mode**:
  - Prefer Quick Fix workflow where possible.
  - Avoid parallelization and extra agents unless required.
  - Limit subagent calls to the minimum necessary.
- If a token budget is provided, check after each step:
  ```bash
  .claude/skills/state-management/utilities/check-budget.sh "$STATE_FILE" "$BUDGET_TOKENS"
  ```

## Output Contract Enforcement
- Save subagent output to `/tmp/agent-output.md`
- Validate before chaining:
  ```bash
  .claude/skills/orchestration/utilities/validate-agent-output.sh /tmp/agent-output.md <role>
  ```

## Recovery
- If tests/build fail once, invoke `debugger` before retrying.
- If review finds critical issues, use `feedback-coordinator`.

## Logs & State
- Logs are automatic in `.claude/logs/orchestration.jsonl`.
- State lives in `.claude/state/` and should be updated every step.
