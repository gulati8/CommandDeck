---
description: Generate cost and performance report from orchestration logs and state files
argument-hint: [state-file-path or "all" for summary]
---

# Cost & Performance Report

Generate a comprehensive cost and performance analysis.

## Process

1. If $ARGUMENTS is a specific state file path:
   - Read that state file
   - Extract all metrics sections
   - Calculate total estimated tokens
   - Estimate cost based on model usage

2. If $ARGUMENTS is "all" or empty:
   - List all state files in `.claude/state/`
   - Aggregate metrics across all orchestrations
   - Provide summary statistics
3. Parse `.claude/logs/orchestration.jsonl` for `subagent_start` / `subagent_complete` pairs:
   - Group by agent name
   - Count invocations
   - Compute durations (timestamp diff between sequential start/complete for same agent)
   - Detect long-running or high-frequency agents

### Log Format Reference
Each Task invocation emits:
```json
{"timestamp":"2024-12-18T12:34:56-08:00","event":"subagent_start","tool":"Task","agent":"code-writer"}
{"timestamp":"2024-12-18T12:35:22-08:00","event":"subagent_complete","tool":"Task","agent":"code-writer"}
```

## Cost Estimation

**Model Pricing** (approximate):
- Haiku: $0.25 / 1M input tokens, $1.25 / 1M output tokens
- Sonnet: $3.00 / 1M input tokens, $15.00 / 1M output tokens
- Opus: $15.00 / 1M input tokens, $75.00 / 1M output tokens

**Estimation Formula**:
```
Estimated Cost = (input_tokens * input_price + output_tokens * output_price) / 1,000,000
```

## Output Format

```markdown
## Cost & Performance Report

**Period**: [Date range if "all", or single orchestration]
**State Files Analyzed**: [Count]

### Total Metrics

| Metric | Value |
|--------|-------|
| Total Orchestrations | N |
| Total Subagent Invocations | N |
| Estimated Total Tokens | N |
| Estimated Total Cost | $X.XX |

### By Model

| Model | Invocations | Est. Tokens | Est. Cost |
|-------|-------------|-------------|-----------|
| Haiku | N | N | $X.XX |
| Sonnet | N | N | $X.XX |
| Opus | N | N | $X.XX |

### By Agent Type

| Agent | Invocations | Avg Tokens | Est. Cost |
|-------|-------------|------------|-----------|
| researcher | N | N | $X.XX |
| planner | N | N | $X.XX |
| code-writer | N | N | $X.XX |
| ... | | | |

### Performance Insights

- **Most expensive orchestration**: [task-name] ($X.XX)
- **Most token-intensive agent**: [agent-name] (N tokens avg)
- **Cost trend**: [Increasing/Stable/Decreasing]
- **Longest-running agent**: [agent-name] (avg duration)
- **Heaviest agent by count**: [agent-name] (invocations)

### Recommendations

[Cost optimization suggestions based on analysis]
```

## Begin

Generate cost report for: **$ARGUMENTS**
