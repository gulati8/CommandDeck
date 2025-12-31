---
description: Full feature development workflow - research, plan, implement, test, review, document
argument-hint: <feature description>
---

# Feature Development Workflow

Feature request: **$ARGUMENTS**

Proceed methodically: research, plan, implement, test, review, and document.

## Command Authority

Based on initial assessment, determine delegation level:
- If this matches an established pattern → Proceed autonomously (Level 1-2)
- If approach options exist → Consult user (Level 3)
- If this is architecturally significant → Agree with user (Level 4)

See ORCHESTRATOR.md "7 Levels of Delegation" for guidance.

## Workflow Phases

Execute these phases in order, updating the state file after each:
**Common rules**: Follow `common-orchestration-rules.md`.

### Phase 1: Initialize State
1. Run: `.claude/skills/state-management/utilities/init-state.sh "$ARGUMENTS" "$ARGUMENTS"`
2. Capture the state file path from output (e.g., `.claude/state/YYYY-MM-DD_feature-name.md`)
3. Store this path in a variable for subsequent updates

### Phase 2: Research
1. Update state: `.claude/skills/state-management/utilities/update-step.sh "$STATE_FILE" "research" "in_progress" "Starting codebase research"`
2. Use the `researcher` subagent to understand:
   - Existing patterns in the codebase relevant to this feature
   - Files that will likely need modification
   - Dependencies and constraints
   - Similar features to reference
3. Update state: `.claude/skills/state-management/utilities/update-step.sh "$STATE_FILE" "research" "complete" "Research summary here"`

### Phase 3: Planning
1. Update state: `.claude/skills/state-management/utilities/update-step.sh "$STATE_FILE" "planning" "in_progress"`
2. **Detect frontend work**: If the feature involves UI components, pages, or user-facing interfaces:
   - If the frontend pack is installed, invoke `premium-ux-designer` for visual specs
   - Provide UX output as context to the planner
3. **Detect cross-system or release sequencing**: If multiple subsystems or deployments are involved:
   - Invoke `integration-coordinator` for sequencing, rollout, and rollback guidance
   - Provide its output as context to the planner
4. **Detect data governance**: If PII, retention, or data exports are involved:
   - Invoke `data-governance-auditor` for lifecycle risks and mitigations
   - Provide its output as context to the planner
5. Use the `planner` subagent to create:
   - Detailed implementation plan (must include UI/UX specifications for frontend work)
   - Parallelization strategy (only if there are independent steps)
   - File changes list
   - Risk assessment
   - Testing strategy
6. Update state: `.claude/skills/state-management/utilities/update-step.sh "$STATE_FILE" "planning" "complete" "Plan created"`

**Checkpoint**: Present the plan to the user and ask for approval before proceeding.
**Dependency check**: If the plan introduces new dependencies, get explicit approval and (if the security pack is installed) invoke `security-auditor` to review risks before implementation.

### Phase 4: Implement
1. Update state: `.claude/skills/state-management/utilities/update-step.sh "$STATE_FILE" "implementation" "in_progress"`
2. **Default to sequential execution**:
   - Execute one `code-writer` at a time unless the plan explicitly marks steps as independent.
3. **Parallelization is opt-in**:
   - Only run parallel `code-writer` tasks when the planner explicitly identifies non-overlapping files and no data dependencies.
4. **Handle results**:
   - If any fail: `.claude/skills/state-management/utilities/update-step.sh "$STATE_FILE" "implementation" "failed" "Error details"`
5. On complete: `.claude/skills/state-management/utilities/update-step.sh "$STATE_FILE" "implementation" "complete" "Files modified"`

### Phase 5: Testing
1. Update state: `.claude/skills/state-management/utilities/update-step.sh "$STATE_FILE" "testing" "in_progress"`
2. Use a single `test-writer` by default.
3. If the plan explicitly calls out independent modules, parallelize test writing only when cost-sensitive mode is not active.
4. **UI flows**: If the feature changes user-facing flows, reference `.claude/skills/playwright-mcp/SKILL.md` and prefer MCP-driven exploration for test stability.
5. **Run tests**: After all test files are created, run the full test suite
6. Update state: `.claude/skills/state-management/utilities/update-step.sh "$STATE_FILE" "testing" "complete" "Tests created and passing"`

### Phase 6: Quality Inspection
1. Update state: `.claude/skills/state-management/utilities/update-step.sh "$STATE_FILE" "review" "in_progress"`
2. Use the `code-reviewer` subagent to:
   - Review all changes made
   - Identify any issues
   - If `must_fix` is non-empty, use `feedback-coordinator` to iterate between `code-reviewer` and `code-writer` (max 3 iterations)
3. Update state: `.claude/skills/state-management/utilities/update-step.sh "$STATE_FILE" "review" "complete" "Review status"`

### Phase 7: Documentation
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
