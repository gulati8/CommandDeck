---
description: Code refactoring workflow - analyze, plan, refactor, test, review
argument-hint: <refactor target and goals>
---

# Refactor Workflow

You are orchestrating a code refactoring for: **$ARGUMENTS**

## Workflow Phases

**Common rules**: Follow `common-orchestration-rules.md`.

### Phase 1: Initialize
1. Run: `.claude/skills/state-management/utilities/init-state.sh "$ARGUMENTS" "$ARGUMENTS"`
2. Capture the state file path from output
3. Log the refactoring goals in the state file

### Phase 2: Analyze
Use the `researcher` subagent to:
- Understand current implementation
- Map dependencies and usages
- Identify code smells or issues
- Find patterns to follow

### Phase 3: Plan
Use the `planner` subagent to:
- Design the refactoring approach
- Break into safe, incremental steps
- Plan rollback strategy
- Identify risks
If multiple subsystems or release sequencing are involved, invoke `integration-coordinator`.
If PII, retention, or data exports are involved, invoke `data-governance-auditor`.

**Checkpoint**: Present refactoring plan for approval.

### Phase 4: Prepare Tests
Use the `test-writer` subagent to:
- Ensure existing test coverage is adequate
- Add tests if needed to catch regressions
- Run tests to establish baseline

### Phase 5: Refactor
Use the `code-writer` subagent for each refactoring step:
- Make changes incrementally
- Run tests after each step
- Update state file with progress

### Phase 6: Review
Use the `code-reviewer` subagent to:
- Verify refactoring goals were met
- Check for regressions
- Confirm code quality improved
If `must_fix` is non-empty, use `feedback-coordinator` to iterate between `code-reviewer` and `code-writer` (max 3 iterations).

### Phase 7: Complete
1. Update state file status to COMPLETED
2. Summarize changes and improvements

## Begin

Start with Phase 1 for refactor: **$ARGUMENTS**
