---
description: Produce a multi-document product/UX/QA specification pack from a brief or idea.
argument-hint: <product idea or scope>
---

# Spec Workflow

## Workflow Phases

**Common rules**: Follow `common-orchestration-rules.md`.

### Phase 1: Initialize
1. Run: `.claude/skills/state-management/utilities/init-state.sh "$ARGUMENTS" "$ARGUMENTS"`
2. Capture the state file path from output

### Phase 2: Discovery
1. Update state: `.claude/skills/state-management/utilities/update-step.sh "$STATE_FILE" "discovery" "in_progress"`
2. Use `product-manager` to frame requirements and scope.
3. Update state: `.claude/skills/state-management/utilities/update-step.sh "$STATE_FILE" "discovery" "complete" "Requirements framed"`

### Phase 3: Spec Drafting
1. Update state: `.claude/skills/state-management/utilities/update-step.sh "$STATE_FILE" "spec" "in_progress"`
2. Use `product-spec-writer` to produce the multi-doc spec pack.
3. Update state: `.claude/skills/state-management/utilities/update-step.sh "$STATE_FILE" "spec" "complete" "Spec pack drafted"`

### Phase 4: Documentation (Optional)
1. Update state: `.claude/skills/state-management/utilities/update-step.sh "$STATE_FILE" "documentation" "in_progress"`
2. Use `documentation-writer` for cleanup/indexing if needed.
3. Update state: `.claude/skills/state-management/utilities/update-step.sh "$STATE_FILE" "documentation" "complete" "Docs updated"`

### Phase 5: Complete
Run: `.claude/skills/state-management/utilities/complete-state.sh "$STATE_FILE" "Spec workflow complete"`

## Begin
Execute Phase 1 for: $ARGUMENTS
