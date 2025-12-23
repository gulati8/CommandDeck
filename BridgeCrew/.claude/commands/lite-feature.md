---
description: Lightweight feature workflow for small scoped changes
argument-hint: <feature description>
---

# Lite Feature Workflow

Feature request: **$ARGUMENTS**

Use this workflow for small scoped changes that still benefit from light research and testing.

## Workflow Phases

**Common rules**: Follow `common-orchestration-rules.md`.

### Phase 1: Initialize
1. Run: `.claude/skills/state-management/utilities/init-state.sh "$ARGUMENTS" "$ARGUMENTS"`
2. Capture the state file path from output

### Phase 2: Research (Optional)
Use `researcher` if file locations or patterns are unclear.

### Phase 3: Plan (Light)
Use `planner` to outline the minimal steps and tests.

### Phase 4: Implement
Use `code-writer` to apply the change (keep diffs tight).

### Phase 5: Test
Use `test-writer` for minimal coverage or note why tests are skipped.

### Phase 6: Review
Use `code-reviewer` for a quick sanity check.

### Phase 7: Complete
Run: `.claude/skills/state-management/utilities/complete-state.sh "$STATE_FILE" "Lite feature completed"`

## Begin

Start with Phase 1 for: **$ARGUMENTS**
