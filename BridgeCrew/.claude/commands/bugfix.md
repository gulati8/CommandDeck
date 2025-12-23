---
description: Bug investigation and fix workflow - research, diagnose, fix, test, verify
argument-hint: <bug description or issue reference>
---

# Bugfix Workflow

**Captain's Log**: Bug investigation mission for: **$ARGUMENTS**

A ship encounters anomalies—our duty is to diagnose, treat, and prevent recurrence. We'll investigate thoroughly before taking action.

## Workflow Phases

**Common rules**: Follow `common-orchestration-rules.md`.

### Phase 1: Initialize
1. Run: `.claude/skills/state-management/utilities/init-state.sh "$ARGUMENTS" "$ARGUMENTS"`
2. Capture the state file path from output
3. Log the bug report/description in the state file

### Phase 2: Investigate
Use the `researcher` subagent to:
- Find code related to the reported issue
- Identify potential root causes
- Gather context about the affected functionality
- Check for related issues or similar patterns

### Phase 3: Diagnose (Dr. Crusher Approach)
Based on research, formulate:
- **Root cause diagnosis** - What's wrong and why
- **Affected systems** - Which components are impacted
- **Prognosis** - Impact if unfixed
- **Recommended treatment** - The fix approach

Use the `debugger` subagent if root cause is unclear.

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
If critical issues are found, use `feedback-coordinator` to iterate between `code-reviewer` and `code-writer` (max 3 iterations).

### Phase 8: Complete
1. Update state file status to COMPLETED
2. Summarize: root cause, fix applied, tests added

## Begin

Start with Phase 1 for bug: **$ARGUMENTS**
