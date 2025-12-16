---
description: Full feature development workflow - research, plan, implement, test, review, document
argument-hint: <feature description>
---

# Feature Development Workflow

**Captain's Log**: New feature development mission for: **$ARGUMENTS**

As with any significant undertaking, we'll proceed methodically—researching the terrain, planning our approach, executing with precision, and validating our work. Let's see what's out there.

## Command Authority

Based on initial assessment, determine delegation level:
- If this matches an established pattern → Proceed autonomously (Level 1-2)
- If approach options exist → Consult user (Level 3)
- If this is architecturally significant → Agree with user (Level 4)

See PICARD.md "7 Levels of Delegation" for guidance.

## Workflow Phases

Execute these phases in order, updating the state file after each:

### Phase 1: Initialize Mission Log
1. Run: `.claude/skills/state-management/utilities/init-state.sh "$ARGUMENTS" "$ARGUMENTS"`
2. Capture the state file path from output (e.g., `.claude/state/2025-12-13_feature-name.md`)
3. Store this path in a variable for subsequent updates

### Phase 2: Reconnaissance
1. Update state: `.claude/skills/state-management/utilities/update-step.sh "$STATE_FILE" "research" "in_progress" "Starting codebase research"`
2. Use the `researcher` subagent to understand:
   - Existing patterns in the codebase relevant to this feature
   - Files that will likely need modification
   - Dependencies and constraints
   - Similar features to reference
3. Update state: `.claude/skills/state-management/utilities/update-step.sh "$STATE_FILE" "research" "complete" "Research summary here"`

### Phase 3: Strategic Planning
1. Update state: `.claude/skills/state-management/utilities/update-step.sh "$STATE_FILE" "planning" "in_progress"`
2. **Detect frontend work**: If the feature involves UI components, pages, or user-facing interfaces:
   - First invoke `premium-ux-designer` to create visual specifications and styling approach
   - Provide the UX design output as context to the planner
3. Use the `planner` subagent to create:
   - Detailed implementation plan (must include UI/UX specifications for frontend work)
   - Parallelization strategy (identify independent steps that can run concurrently)
   - File changes list
   - Risk assessment
   - Testing strategy
4. Update state: `.claude/skills/state-management/utilities/update-step.sh "$STATE_FILE" "planning" "complete" "Plan created"`

**Checkpoint**: Present the plan to the user and ask for approval before proceeding.

### Phase 4: Engage (Parallel Execution)
1. Update state: `.claude/skills/state-management/utilities/update-step.sh "$STATE_FILE" "implementation" "in_progress"`
2. **Analyze the plan's parallelization strategy**:
   - Review the parallel execution groups identified by the planner
   - Group independent steps together (different files, no data dependencies)
   - Identify sequential dependencies (steps that need previous outputs)
3. **Execute implementation in parallel phases**:
   - **For each parallel group**: Invoke multiple `code-writer` subagents in a SINGLE message
     - Example: If Step 2, 3, 4 are independent → invoke 3 code-writers simultaneously
   - **Wait for all parallel tasks to complete** before proceeding to next group
   - **For sequential steps**: Execute one at a time when they depend on previous outputs
4. **Handle results after each parallel group**:
   - Check status of all parallel tasks
   - If any fail: `.claude/skills/state-management/utilities/update-step.sh "$STATE_FILE" "implementation" "failed" "Error details"`
   - If all succeed: Continue to next parallel group or sequential step
5. On complete: `.claude/skills/state-management/utilities/update-step.sh "$STATE_FILE" "implementation" "complete" "Files modified"`

**Key Rule**: NEVER execute independent steps sequentially. Always parallelize when the plan identifies safe parallel groups.

### Phase 5: Verify Systems (Parallel Testing)
1. Update state: `.claude/skills/state-management/utilities/update-step.sh "$STATE_FILE" "testing" "in_progress"`
2. **Parallel test creation**: If multiple independent modules/components were implemented:
   - Identify modules that need separate test files (e.g., Auth module, API module, DB module)
   - Invoke multiple `test-writer` subagents in parallel (one per module) in a SINGLE message
   - Example: Auth + API + DB → 3 parallel test-writers invoked simultaneously
3. **For single-module features**: Use single `test-writer` subagent
4. **Run tests**: After all test files are created, run the full test suite
5. Update state: `.claude/skills/state-management/utilities/update-step.sh "$STATE_FILE" "testing" "complete" "Tests created and passing"`

**Parallelization benefit**: Writing tests for 3 modules in parallel instead of sequentially saves ~65% of time.

### Phase 6: Quality Inspection
1. Update state: `.claude/skills/state-management/utilities/update-step.sh "$STATE_FILE" "review" "in_progress"`
2. Use the `code-reviewer` subagent to:
   - Review all changes made
   - Identify any issues
   - If critical issues found, use code-writer to fix them
3. Update state: `.claude/skills/state-management/utilities/update-step.sh "$STATE_FILE" "review" "complete" "Review status"`

### Phase 7: Archive Records
1. Update state: `.claude/skills/state-management/utilities/update-step.sh "$STATE_FILE" "documentation" "in_progress"`
2. Use the `documentation-writer` subagent to:
   - Update relevant documentation
   - Add inline comments if needed
   - Update README if applicable
3. Update state: `.claude/skills/state-management/utilities/update-step.sh "$STATE_FILE" "documentation" "complete" "Docs updated"`

### Phase 8: Mission Complete
1. Run: `.claude/skills/state-management/utilities/complete-state.sh "$STATE_FILE" "Feature successfully implemented, tested, reviewed, and documented"`
2. Provide final summary to user

## Begin

Start with Phase 1 for feature: **$ARGUMENTS**
