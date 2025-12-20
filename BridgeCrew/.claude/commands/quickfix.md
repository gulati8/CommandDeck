---
description: Fast path for tiny, low-risk changes (1-2 files, minimal scope)
argument-hint: <tiny change description>
---

# Quick Fix Workflow

Use this workflow for small, low-risk changes where a full feature pipeline would be overkill.

## Workflow Phases

**Output validation**: After each subagent completes, save its output to a temp file and validate with `.claude/skills/orchestration/utilities/validate-agent-output.sh /tmp/agent-output.md <role>`. If validation fails, request a re-emit before proceeding.

### Phase 1: Initialize
1. Run: `.claude/skills/state-management/utilities/init-state.sh "$ARGUMENTS" "$ARGUMENTS"`
2. Capture the state file path from output

### Phase 2: Clarify (Optional)
Use `researcher` only if the exact file/line is unclear.

### Phase 3: Implement
Use `code-writer` to apply the minimal change (1-2 files only).

### Phase 4: Review
Use `code-reviewer` for a quick sanity check.

### Phase 5: Verify (Optional)
Run the smallest relevant test or note why tests were not run.

### Phase 6: Complete
Run: `.claude/skills/state-management/utilities/complete-state.sh "$STATE_FILE" "Quick fix completed"`

## Begin

Start with Phase 1 for: **$ARGUMENTS**
