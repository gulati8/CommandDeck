---
name: state-management
description: Utilities and templates for automatic orchestration state tracking. Use to initialize, update, and complete state files without manual intervention.
---

# State Management Skill

This skill provides automatic state file management for orchestrations.

## Purpose

Eliminate manual state file creation and updates by using bash-based utilities that the orchestrator can call automatically.

## Contents

- `utilities/` - Bash utility scripts for state operations
- `templates/` - State file templates

## Quick Reference

### Initialize State

```bash
.claude/skills/state-management/utilities/init-state.sh "task-name" "Original user request"
```

Creates: `.claude/state/{YYYY-MM-DD}_{task-slug}.md`

### Update Step

```bash
.claude/skills/state-management/utilities/update-step.sh "{state-file}" "step-name" "status" "details"
```

Status: `pending`, `in_progress`, `complete`, `failed`

### Complete State

```bash
.claude/skills/state-management/utilities/complete-state.sh "{state-file}" "Final summary"
```

### Query State

```bash
.claude/skills/state-management/utilities/get-state.sh "{state-file}"
```

Returns the current state file content for orchestrator reference.

## Usage in Workflows

Workflows should call these utilities instead of manually creating/updating state files:

```markdown
### Phase 1: Initialize
1. Run: `.claude/skills/state-management/utilities/init-state.sh "add-user-auth" "Add user authentication with JWT"`
2. Capture the state file path from output
3. Proceed with orchestration
```

## Benefits

- **Consistency**: All state files follow the same format
- **Automation**: No manual markdown writing
- **Validation**: Scripts ensure required fields are present
- **Atomicity**: Updates are append-only to prevent corruption
