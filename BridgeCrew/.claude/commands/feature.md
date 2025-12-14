---
description: Full feature development workflow - research, plan, implement, test, review, document
argument-hint: <feature description>
---

# Feature Development Workflow

You are orchestrating a complete feature development for: **$ARGUMENTS**

## Workflow Phases

Execute these phases in order, updating the state file after each:

### Phase 1: Initialize
1. Run: `.claude/skills/state-management/utilities/init-state.sh "$ARGUMENTS" "$ARGUMENTS"`
2. Capture the state file path from output (e.g., `.claude/state/2025-12-13_feature-name.md`)
3. Store this path in a variable for subsequent updates

### Phase 2: Research
1. Update state: `.claude/skills/state-management/utilities/update-step.sh "$STATE_FILE" "research" "in_progress" "Starting codebase research"`
2. Use the `researcher` subagent to understand:
   - Existing patterns in the codebase relevant to this feature
   - Files that will likely need modification
   - Dependencies and constraints
   - Similar features to reference
3. Update state: `.claude/skills/state-management/utilities/update-step.sh "$STATE_FILE" "research" "complete" "Research summary here"`

### Phase 3: Plan
1. Update state: `.claude/skills/state-management/utilities/update-step.sh "$STATE_FILE" "planning" "in_progress"`
2. Use the `planner` subagent to create:
   - Detailed implementation plan
   - File changes list
   - Risk assessment
   - Testing strategy
3. Update state: `.claude/skills/state-management/utilities/update-step.sh "$STATE_FILE" "planning" "complete" "Plan created"`

**Checkpoint**: Present the plan to the user and ask for approval before proceeding.

### Phase 4: Implement
1. Update state: `.claude/skills/state-management/utilities/update-step.sh "$STATE_FILE" "implementation" "in_progress"`
2. Use the `code-writer` subagent for each implementation step in the plan
3. Work through steps sequentially
4. If a step fails: `.claude/skills/state-management/utilities/update-step.sh "$STATE_FILE" "implementation" "failed" "Error details"`
5. On success: `.claude/skills/state-management/utilities/update-step.sh "$STATE_FILE" "implementation" "complete" "Files modified"`

### Phase 5: Test
1. Update state: `.claude/skills/state-management/utilities/update-step.sh "$STATE_FILE" "testing" "in_progress"`
2. Use the `test-writer` subagent to:
   - Create tests for the new feature
   - Run tests and verify they pass
3. Update state: `.claude/skills/state-management/utilities/update-step.sh "$STATE_FILE" "testing" "complete" "Tests created and passing"`

### Phase 6: Review
1. Update state: `.claude/skills/state-management/utilities/update-step.sh "$STATE_FILE" "review" "in_progress"`
2. Use the `code-reviewer` subagent to:
   - Review all changes made
   - Identify any issues
   - If critical issues found, use code-writer to fix them
3. Update state: `.claude/skills/state-management/utilities/update-step.sh "$STATE_FILE" "review" "complete" "Review status"`

### Phase 7: Document
1. Update state: `.claude/skills/state-management/utilities/update-step.sh "$STATE_FILE" "documentation" "in_progress"`
2. Use the `documentation-writer` subagent to:
   - Update relevant documentation
   - Add inline comments if needed
   - Update README if applicable
3. Update state: `.claude/skills/state-management/utilities/update-step.sh "$STATE_FILE" "documentation" "complete" "Docs updated"`

### Phase 8: Complete
1. Run: `.claude/skills/state-management/utilities/complete-state.sh "$STATE_FILE" "Feature successfully implemented, tested, reviewed, and documented"`
2. Provide final summary to user

## Begin

Start with Phase 1 for feature: **$ARGUMENTS**
