---
description: Lightweight bugfix workflow for small, isolated issues
argument-hint: <bug description or issue reference>
---

# Lite Bugfix Workflow

Bug report: **$ARGUMENTS**

Use this workflow for small, localized fixes with low risk.

## Workflow Phases

**Common rules**: Follow `common-orchestration-rules.md`.

### Phase 1: Initialize
1. Run: `.claude/skills/state-management/utilities/init-state.sh "$ARGUMENTS" "$ARGUMENTS"`
2. Capture the state file path from output

### Phase 2: Investigate (Light)
Use `researcher` to locate the affected code and identify likely root cause.

### Phase 3: Implement
Use `code-writer` to apply the minimal fix.

### Phase 4: Test
Use `test-writer` to add a regression test or document why tests are skipped.

### Phase 5: Review
Use `code-reviewer` for a quick sanity check.

### Phase 6: Complete
Run: `.claude/skills/state-management/utilities/complete-state.sh "$STATE_FILE" "Lite bugfix completed"`

## Begin

Start with Phase 1 for: **$ARGUMENTS**
