---
description: Planning only - research and create detailed plan without executing
argument-hint: <what to plan>
---

# Planning Workflow

You are creating a detailed plan for: **$ARGUMENTS**

This is a planning-only workflow. No implementation will occur.

## Workflow Phases

**Common rules**: Follow `common-orchestration-rules.md`.

### Phase 1: Research
Use the `researcher` subagent to:
- Understand the codebase context
- Identify relevant files and patterns
- Gather constraints and dependencies

### Phase 2: Plan
Use the `planner` subagent to create a comprehensive plan including:
- Step-by-step implementation approach
- File changes summary
- Risk assessment
- Testing strategy
- Time/complexity estimate

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

## Begin

Start research and planning for: **$ARGUMENTS**
