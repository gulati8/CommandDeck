---
description: Display human-readable summary of recent orchestration logs
argument-hint: [number of entries, default 10]
---

# Log Summary

Generate a human-readable summary of recent orchestration activity using the log-analyzer agent.

## Process

Delegate to the `log-analyzer` subagent with the following task:

## Task
Analyze the orchestration logs and generate a comprehensive summary report.

## Context
- **Files**: `.claude/logs/orchestration.jsonl`
- **Information**:
  - Focus on the last $ARGUMENTS entries (or 10 if not specified)
  - Include both basic event logs and rich task metadata
  - Current date: [insert current date]

## Constraints
- **Scope**: Summary report with statistics and recent activity
- **Avoid**: Deep debugging analysis (unless specifically requested)

## Expected Output
- **Format**: markdown
- **Include**:
  - Activity overview (total events, success rate)
  - Agent usage statistics
  - Recent activity timeline (last N events)
  - List of failures/errors if any
  - Brief recommendations or insights

## Begin

Delegate to log-analyzer for: $ARGUMENTS entries (or 10 if not specified)
