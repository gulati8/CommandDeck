# State Management Guide

This guide explains how to create, update, and maintain orchestration state files for tracking workflow progress.

## State File Purpose

State files serve as:
- **Progress tracker** - Record what's been done and what's next
- **Recovery mechanism** - Resume work after interruptions
- **Audit trail** - Document the orchestration history
- **Metrics repository** - Track costs and performance

## Filename Convention

Create state files using this naming pattern:

**Format**: `.claude/state/{YYYY-MM-DD}_{task-slug}.md`

**Examples**:
- `.claude/state/2025-12-18_add-dark-mode.md`
- `.claude/state/2025-12-18_fix-checkout-bug.md`
- `.claude/state/2025-12-18_refactor-auth-service.md`

## State File Structure Template

```markdown
# Orchestration: {Task Name}

**Started**: {ISO timestamp}
**Status**: IN_PROGRESS | COMPLETED | FAILED | PAUSED

## Original Request
{User's exact request, verbatim}

## Decomposition
1. {Step 1 description} → {subagent}
2. {Step 2 description} → {subagent}
3. {Step 3 description} → {subagent}
...

## Execution Log

### Step 1: {Description}
- **Subagent**: {name}
- **Status**: ⏳ Pending | 🔄 In Progress | ✅ Complete | ❌ Failed
- **Result Summary**: {brief summary when complete}
- **Files Modified**: {list if applicable}
- **Notes**: {any issues or observations}

### Step 2: {Description}
- **Subagent**: {name}
- **Status**: ⏳ Pending | 🔄 In Progress | ✅ Complete | ❌ Failed
- **Result Summary**: {brief summary when complete}
- **Files Modified**: {list if applicable}
- **Notes**: {any issues or observations}

...

## Metrics
- **Total Subagent Calls**: {count}
- **Model Usage**:
  - haiku: {count} calls
  - sonnet: {count} calls
  - opus: {count} calls
- **Estimated Tokens**: ~{rough estimate}

## Final Summary
{Completed when orchestration finishes - include:
- What was accomplished
- Files created/modified
- Outstanding issues or warnings
- Recommended next steps}
```

## Update Guidelines

### When to Update State

Update the state file:
1. **At start** - Create file with decomposition plan
2. **Before each step** - Mark step as "In Progress"
3. **After each step** - Mark step as complete or failed, add summary
4. **On failure** - Document error and recovery attempts
5. **At completion** - Add final summary and mark status as COMPLETED

### Using State Management Utilities

Use the bash utilities in `.claude/skills/state-management/utilities/`:

**Initialize state**:
```bash
.claude/skills/state-management/utilities/init-state.sh "task-slug" "Task Name" "User request"
```

**Update step status**:
```bash
.claude/skills/state-management/utilities/update-step.sh "$STATE_FILE" "step-name" "complete|failed|in_progress" "Summary or error message"
```

**Add metrics**:
```bash
.claude/skills/state-management/utilities/add-metrics.sh "$STATE_FILE" "step-name" "haiku|sonnet|opus" "estimated-tokens"
```

**Mark complete**:
```bash
.claude/skills/state-management/utilities/complete-state.sh "$STATE_FILE" "Final summary message"
```

**Retrieve state**:
```bash
.claude/skills/state-management/utilities/get-state.sh "$STATE_FILE"
```

## State File Example

```markdown
# Orchestration: Add Dark Mode Toggle

**Started**: 2025-12-18T14:30:00Z
**Status**: IN_PROGRESS

## Original Request
Add a dark mode toggle to the application settings

## Decomposition
1. Research existing theme patterns → researcher
2. Design dark mode implementation → planner
3. Implement theme switching → code-writer
4. Review implementation → code-reviewer
5. Add tests → test-writer
6. Update documentation → documentation-writer

## Execution Log

### Step 1: Research Theme Patterns
- **Subagent**: researcher
- **Status**: ✅ Complete
- **Result Summary**: Found Tailwind theme configuration in tailwind.config.js. App uses CSS variables for colors. No existing dark mode support.
- **Files Modified**: None (read-only)
- **Notes**: Theme is well-structured, should be straightforward to extend

### Step 2: Design Implementation
- **Subagent**: planner
- **Status**: ✅ Complete
- **Result Summary**: Recommended approach using CSS variables and localStorage. Plan includes 4 file modifications.
- **Files Modified**: None (planning phase)
- **Notes**: Chose CSS variables over Tailwind classes for better performance

### Step 3: Implement Theme Switching
- **Subagent**: code-writer
- **Status**: 🔄 In Progress
- **Result Summary**: [pending]
- **Files Modified**: [pending]
- **Notes**: [pending]

### Step 4: Review Implementation
- **Subagent**: code-reviewer
- **Status**: ⏳ Pending
- **Result Summary**: [pending]
- **Files Modified**: N/A
- **Notes**: [pending]

### Step 5: Add Tests
- **Subagent**: test-writer
- **Status**: ⏳ Pending
- **Result Summary**: [pending]
- **Files Modified**: [pending]
- **Notes**: [pending]

### Step 6: Update Documentation
- **Subagent**: documentation-writer
- **Status**: ⏳ Pending
- **Result Summary**: [pending]
- **Files Modified**: [pending]
- **Notes**: [pending]

## Metrics
- **Total Subagent Calls**: 2 (so far)
- **Model Usage**:
  - haiku: 1 call (researcher)
  - sonnet: 1 call (planner)
  - opus: 0 calls
- **Estimated Tokens**: ~15,000

## Final Summary
[To be completed]
```

## Best Practices

1. **Update immediately** - Don't wait to batch updates
2. **Be concise** - Summaries should be 1-3 sentences
3. **Track files** - Always list modified files for each step
4. **Note issues** - Document problems even if resolved
5. **Use utilities** - Leverage bash scripts for consistency
6. **Include metrics** - Track model usage and token estimates
7. **Write for recovery** - Anyone should be able to resume from state file
8. **Status symbols** - Use emoji for quick visual scanning (⏳ Pending, 🔄 In Progress, ✅ Complete, ❌ Failed)
