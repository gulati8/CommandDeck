# Planning Task Template

Use this template when delegating to `planner`. Keep it actionable and scoped.

```markdown
## Task
Plan: {goal}

## Context
- Constraints: {budget, timelines, risk tolerance}
- Known patterns: {files/architecture to follow}
- Dependencies: {APIs/services}

## Expectations
- Minimal viable plan; no speculative scope
- Call out risks and unknowns explicitly
- Include test and rollback strategy

## Expected Output (per Agent Output Contract)
- `plan_steps` (ordered, checkable)
- `parallel_groups` (if any; else [])
- `test_plan`
- `rollback_plan`
```
