---
description: Planning only - research and create detailed plan without executing
argument-hint: <what to plan>
---

# Planning Workflow

You are creating a detailed plan for: **$ARGUMENTS**

This is a planning-only workflow. No implementation will occur.

## Workflow Phases

**Common rules**: Follow `common-orchestration-rules.md`.

### Phase 0: Initialize
1. Run: `.claude/skills/state-management/utilities/init-state.sh "$ARGUMENTS" "$ARGUMENTS"`
2. Capture the state file path from output

### Phase 1: Research
1. Update state: `.claude/skills/state-management/utilities/update-step.sh "$STATE_FILE" "research" "in_progress"`
2. Use the `researcher` subagent to:
- Understand the codebase context
- Identify relevant files and patterns
- Gather constraints and dependencies
3. Update state: `.claude/skills/state-management/utilities/update-step.sh "$STATE_FILE" "research" "complete" "Research complete"`

### Phase 2: Plan
1. Update state: `.claude/skills/state-management/utilities/update-step.sh "$STATE_FILE" "planning" "in_progress"`
2. Use the `planner` subagent to create a comprehensive plan including:
- Step-by-step implementation approach
- File changes summary
- Risk assessment
- Testing strategy
- Time/complexity estimate
3. Update state: `.claude/skills/state-management/utilities/update-step.sh "$STATE_FILE" "planning" "complete" "Plan drafted"`

### Phase 3: Present
Present the complete plan to the user with:
- Executive summary
- Detailed steps
- Considerations and risks
- Recommended next steps

The user can then:
- Approve and use `/project:feature` to execute
- Request modifications to the plan
- Archive for later

### Phase 4: Complete
Run: `.claude/skills/state-management/utilities/complete-state.sh "$STATE_FILE" "Plan delivered"`

## Begin

Start with Phase 0 for: **$ARGUMENTS**
