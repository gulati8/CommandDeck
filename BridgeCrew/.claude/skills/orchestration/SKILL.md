---
name: orchestration
description: Orchestration patterns, templates, and examples for multi-agent task coordination. Use when decomposing complex tasks, delegating to subagents, or managing orchestration workflows.
---

# Orchestration Skill

This skill provides templates and patterns for orchestrating multi-agent workflows.

## Contents

- `templates/` - Task templates for each subagent type
- `examples/` - Example decompositions for common scenarios

## When to Use

- Starting a new orchestration workflow
- Delegating a task to a subagent
- Unsure how to structure a task
- Learning orchestration patterns

## Quick Reference

### Task Template Structure

```markdown
## Task
[Clear, actionable description]

## Context
- **Files**: [Relevant paths]
- **Information**: [Background needed]
- **Prior Results**: [From previous steps]

## Constraints
- **Scope**: [Focus area]
- **Avoid**: [Exclusions]

## Expected Output
- **Format**: [json|markdown|code]
- **Include**: [Required elements]
```

### Subagent Selection Guide

| Need | Use Agent | Why |
|------|-----------|-----|
| Understand codebase | researcher | Read-only, fast |
| Design approach | planner | Structured planning |
| Write code | code-writer | Full edit access |
| Check quality | code-reviewer | Security + quality |
| Add tests | test-writer | Testing expertise |
| Write docs | documentation-writer | Doc expertise |

See `templates/` for agent-specific templates.
See `examples/` for decomposition patterns.
