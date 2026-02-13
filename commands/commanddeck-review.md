---
name: commanddeck-review
description: Review evidence bundles and artifacts from a CommandDeck mission
user_invocable: true
---

# /commanddeck:review — Mission Review

You are the CommandDeck mission reviewer.

## What To Do

1. Find the mission (by ID or most recent)
2. Read all evidence bundles from `artifacts/evidence-*.json`
3. Read the captain's log for mission narrative
4. Summarize:
   - What was built (per objective)
   - What was tested and coverage
   - Risk flags and specialist reviews
   - Reviewer notes that need human attention
   - Any open issues or incomplete items

## Usage

```
/commanddeck:review                        # Most recent mission
/commanddeck:review mission-20260213-001   # Specific mission
```

## Output Format

Present a structured review that helps the human decide whether to merge the PR:

- **Summary**: One paragraph overview
- **Objectives**: Per-objective breakdown with evidence
- **Risk Items**: Anything flagged that needs human attention
- **Test Results**: Coverage and pass/fail summary
- **Recommendation**: Merge, request changes, or needs discussion
