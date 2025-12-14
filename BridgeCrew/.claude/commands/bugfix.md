---
description: Bug investigation and fix workflow - research, diagnose, fix, test, verify
argument-hint: <bug description or issue reference>
---

# Bugfix Workflow

You are orchestrating a bug investigation and fix for: **$ARGUMENTS**

## Workflow Phases

### Phase 1: Initialize
1. Create state file: `.claude/state/{date}_bugfix_{slug}.md`
2. Log the bug report/description
3. Set status to IN_PROGRESS

### Phase 2: Investigate
Use the `researcher` subagent to:
- Find code related to the reported issue
- Identify potential root causes
- Gather context about the affected functionality
- Check for related issues or similar patterns

### Phase 3: Diagnose
Based on research, formulate:
- Root cause hypothesis
- Affected components
- Reproduction steps (if not provided)

Log diagnosis in state file.

### Phase 4: Plan Fix
Use the `planner` subagent to:
- Design the minimal fix
- Identify any risks
- Plan verification approach

### Phase 5: Implement Fix
Use the `code-writer` subagent to:
- Implement the fix
- Keep changes minimal and targeted

### Phase 6: Test
Use the `test-writer` subagent to:
- Add test case that reproduces the bug
- Verify test fails without fix, passes with fix
- Check for regressions

### Phase 7: Verify
Use the `code-reviewer` subagent to:
- Review the fix
- Confirm it addresses root cause (not just symptoms)
- Check for unintended side effects

### Phase 8: Complete
1. Update state file status to COMPLETED
2. Summarize: root cause, fix applied, tests added

## Begin

Start with Phase 1 for bug: **$ARGUMENTS**
