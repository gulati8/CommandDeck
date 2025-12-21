# Logging & Metrics Requirements

To enable rich observability, debugging, and cost tracking, subagent invocations are logged automatically via hooks in `.claude/settings.json`.

## Automatic Hook Logs

Each Task invocation emits two entries:
- `subagent_start`
- `subagent_complete`

These include `agent`, `model`, `task_summary`, and `id` for correlation.

**Example**:
```json
{
  "timestamp": "2025-12-18T14:30:00Z",
  "event": "subagent_start",
  "tool": "Task",
  "agent": "planner",
  "model": "sonnet",
  "task_summary": "Design dark mode implementation approach",
  "id": "f00d..."
}
```

```json
{
  "timestamp": "2025-12-18T14:35:00Z",
  "event": "subagent_complete",
  "tool": "Task",
  "agent": "planner",
  "model": "sonnet",
  "task_summary": "Design dark mode implementation approach",
  "status": "complete",
  "id": "f00d..."
}
```

**Also add metrics to state file**:
```bash
.claude/skills/state-management/utilities/add-metrics.sh "$STATE_FILE" "STEP_NAME" "MODEL_NAME" "ESTIMATED_TOKENS"
```

## Error Logging

If a subagent fails or returns incomplete results:

```bash
echo "{\"timestamp\": \"$(date -Iseconds)\", \"event\": \"task_failed\", \"agent\": \"AGENT_NAME\", \"error\": \"ERROR_DESCRIPTION\", \"recovery_attempted\": \"STRATEGY_USED\"}" >> .claude/logs/orchestration.jsonl
```

**Example**:
```bash
echo "{\"timestamp\": \"$(date -Iseconds)\", \"event\": \"task_failed\", \"agent\": \"code-writer\", \"error\": \"Cannot find module 'types/User'\", \"recovery_attempted\": \"Level 1 - Retry with explicit type import path\"}" >> .claude/logs/orchestration.jsonl
```

## Log Entry Types

### 1. Subagent Start (Hook)
```json
{
  "timestamp": "2025-12-18T14:30:00Z",
  "event": "subagent_start",
  "tool": "Task",
  "agent": "planner",
  "model": "sonnet",
  "task_summary": "Design dark mode implementation approach",
  "id": "f00d..."
}
```

### 2. Subagent Complete (Hook)
```json
{
  "timestamp": "2025-12-18T14:35:00Z",
  "event": "subagent_complete",
  "tool": "Task",
  "agent": "planner",
  "model": "sonnet",
  "task_summary": "Design dark mode implementation approach",
  "status": "complete",
  "id": "f00d..."
}
```

### 3. Task Failure (Manual)
```json
{
  "timestamp": "2025-12-18T14:40:00Z",
  "event": "task_failed",
  "agent": "code-writer",
  "error": "Type 'Theme' is not defined",
  "recovery_attempted": "Level 1 - Added Theme type definition"
}
```

### 4. Recovery Success
```json
{
  "timestamp": "2025-12-18T14:42:00Z",
  "event": "recovery_successful",
  "agent": "code-writer",
  "recovery_level": "1",
  "resolution": "Added missing type definition, implementation succeeded"
}
```

### 5. User Escalation
```json
{
  "timestamp": "2025-12-18T14:45:00Z",
  "event": "user_escalation",
  "reason": "Ambiguous OAuth provider choice",
  "attempted_recoveries": ["Level 1 retry", "Level 2 debugger analysis"],
  "user_decision": "pending"
}
```

## Cost Tracking

Use `/project:costs:report` to generate cost analysis reports.

The log-analyzer agent will parse `orchestration.jsonl` to calculate:
- Total subagent invocations by model type
- Estimated token usage per orchestration
- Average tokens per agent type
- Cost projections based on usage patterns

**Manual cost tracking**:
```bash
# Count all task delegations
grep "subagent_start" .claude/logs/orchestration.jsonl | wc -l

# Count by model
grep "haiku" .claude/logs/orchestration.jsonl | grep "subagent_start" | wc -l
grep "sonnet" .claude/logs/orchestration.jsonl | grep "subagent_start" | wc -l

# Count failures
grep "task_failed" .claude/logs/orchestration.jsonl | wc -l
```

## Context Summarization

For long-running orchestrations, invoke `summarizer` periodically to prevent context bloat.

**Triggers for summarization**:
- State file >300 lines
- After 6 subagent invocations
- Before major phase transitions
- Approaching context limits

**Process**:
1. Invoke `summarizer` with current state file
2. Save summary to `.claude/state/{task}_summary_{N}.md`
3. Use summary + recent 2-3 steps for subsequent context
4. Log the summarization event

**Example**:
```bash
echo "{\"timestamp\": \"$(date -Iseconds)\", \"event\": \"context_summarized\", \"state_file\": \"2025-12-18_add-auth.md\", \"summary_file\": \"2025-12-18_add-auth_summary_1.md\", \"steps_summarized\": 7}" >> .claude/logs/orchestration.jsonl
```

## Agent Feedback Loops

For iterative work (review → fix cycles), use `feedback-coordinator` instead of manual orchestration to reduce overhead.

**When to use**:
- Code-reviewer finds critical issues requiring fixes
- Test failures needing iterative debugging
- Any scenario requiring agent-to-agent iteration

**Process**:
```
1. Initial work complete (e.g., code-writer finishes implementation)
2. Invoke feedback-coordinator with:
   - Agent A: code-reviewer
   - Agent B: code-writer
   - Max iterations: 3
3. Coordinator manages the iteration loop
4. Receives final status when converged or max iterations reached
```

**Benefits**:
- Reduces orchestrator overhead (fewer context switches)
- Faster iteration cycles
- Automatic convergence detection
- Built-in escalation after max attempts

**Logging feedback loops**:
```bash
echo "{\"timestamp\": \"$(date -Iseconds)\", \"event\": \"feedback_loop_started\", \"coordinator\": \"feedback-coordinator\", \"agent_a\": \"code-reviewer\", \"agent_b\": \"code-writer\", \"max_iterations\": 3}" >> .claude/logs/orchestration.jsonl

# After loop completes
echo "{\"timestamp\": \"$(date -Iseconds)\", \"event\": \"feedback_loop_completed\", \"iterations\": 2, \"outcome\": \"converged\", \"final_status\": \"all_issues_resolved\"}" >> .claude/logs/orchestration.jsonl
```

## Log Analysis Commands

**View recent activity**:
```bash
tail -n 20 .claude/logs/orchestration.jsonl | jq .
```

**Count tasks by agent**:
```bash
grep "subagent_start" .claude/logs/orchestration.jsonl | jq -r .agent | sort | uniq -c
```

**Find all failures**:
```bash
grep "task_failed" .claude/logs/orchestration.jsonl | jq .
```

**Calculate success rate**:
```bash
total=$(grep "subagent_start" .claude/logs/orchestration.jsonl | wc -l)
failed=$(grep "task_failed" .claude/logs/orchestration.jsonl | wc -l)
success_rate=$(echo "scale=2; (($total - $failed) / $total) * 100" | bc)
echo "Success rate: $success_rate%"
```

## Best Practices

1. **Rely on hooks** - `subagent_start` and `subagent_complete` are automatic; keep them enabled
2. **Include context** - Task summaries should be descriptive enough to understand what was attempted
3. **Log recovery attempts** - Track all failure recovery efforts for debugging
4. **Use consistent formatting** - Follow JSON structure exactly for parsing
5. **Don't skip metrics** - Add `add-metrics.sh` entries for cost and model usage
6. **Update state AND logs** - State file is for human reading, logs are for programmatic analysis
7. **Timestamp everything** - Use ISO 8601 format for consistent sorting and parsing
8. **Sanitize sensitive data** - Never log secrets, credentials, or PII
