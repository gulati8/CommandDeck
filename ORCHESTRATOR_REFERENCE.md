# Orchestrator Agent System - Reference Guide

This document provides detailed explanations of each component in the orchestrator system. Use this to understand the architecture, customize components, or troubleshoot issues.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [CLAUDE.md - The Orchestrator Brain](#claudemd---the-orchestrator-brain)
3. [Subagents](#subagents)
4. [Slash Commands](#slash-commands)
5. [Skills](#skills)
6. [Hooks & Logging](#hooks--logging)
7. [State Management](#state-management)
8. [Customization Guide](#customization-guide)
9. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER REQUEST                            │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    MAIN CLAUDE SESSION                          │
│                    (The Orchestrator)                           │
│                                                                 │
│  Guided by: CLAUDE.md                                           │
│  Entry points: /project:feature, /project:bugfix, etc.          │
│  State tracking: .claude/state/{task}.md                        │
└─────────────────────────────────────────────────────────────────┘
        │               │               │               │
        ▼               ▼               ▼               ▼
   ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
   │researcher│    │ planner │    │code-    │    │test-    │
   │         │    │         │    │writer   │    │writer   │
   │ haiku   │    │ sonnet  │    │ sonnet  │    │ sonnet  │
   │ R/O     │    │ R/O     │    │ R/W     │    │ R/W     │
   └─────────┘    └─────────┘    └─────────┘    └─────────┘

   Each subagent:
   - Receives ONLY a structured task prompt
   - Operates in isolated context
   - Returns structured results
   - Cannot spawn other subagents
```

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Main session = orchestrator | Avoids 20K token overhead of subagent nesting; subagents can't spawn subagents anyway |
| Markdown templates over JSON | More natural for prompt-based communication; easier to read and debug |
| Per-task state files | Enables resumability, debugging, and historical analysis |
| Model tiering | Cost optimization: haiku for simple tasks, sonnet for complex work |
| Tool restrictions | Security and focus: researchers can't modify, writers have full access |

---

## CLAUDE.md - The Orchestrator Brain

**Location**: Project root (`./CLAUDE.md`)

This file instructs the main Claude session how to behave as an orchestrator. Claude reads this at the start of every session.

### Key Sections

#### Core Principles
Establishes the fundamental rules:
- Delegate, don't implement
- Isolated context for subagents
- Structured communication
- State persistence
- Graceful failure handling

#### Task Decomposition Process
The six-step process Claude follows:
1. Analyze the request
2. Decompose into atomic tasks
3. Sequence based on dependencies
4. Create state file
5. Execute via subagents
6. Synthesize results

#### Task Template Format
The standardized structure for subagent communication:
- **Task**: What to do
- **Context**: Files, information, prior results
- **Constraints**: Scope, avoid, dependencies
- **Expected Output**: Format, include, exclude

#### Failure Handling
Explicit rules for error scenarios:
- Incomplete results → retry with smaller scope
- Timeouts → log and continue
- Conflicts → document and flag for user

#### Result Aggregation
How to combine outputs from multiple subagents:
- Sequential: chain outputs
- Parallel: collect then merge
- Final synthesis format

---

## Subagents

**Location**: `.claude/agents/`

### researcher.md

**Purpose**: Read-only codebase exploration

**Model**: haiku (fast, cheap)

**Tools**: Read, Grep, Glob (no write access)

**When to use**:
- Understanding existing code before changes
- Finding relevant files and patterns
- Gathering context for planning

**Output format**:
```markdown
## Findings
### [Category]
- Location: `path:line`
- Content: [snippet]
- Relevance: [why it matters]

## Summary
[Overview]

## Recommendations
[Suggestions - no implementation]
```

---

### planner.md

**Purpose**: Detailed implementation planning

**Model**: sonnet (good reasoning)

**Tools**: Read, Grep, Glob (planning doesn't need write)

**When to use**:
- Before any non-trivial implementation
- Designing approach for features/refactors
- Risk assessment

**Output format**:
```markdown
## Implementation Plan: [Title]

### Overview
[Summary]

### Prerequisites
[What must be true]

### Steps
#### Step 1: [Title]
- Files: [affected]
- Action: [what to do]
- Validation: [how to verify]

### File Changes Summary
[Table of files → actions]

### Risks & Considerations
[What could go wrong]

### Estimated Complexity
[Low/Medium/High]
```

---

### code-writer.md

**Purpose**: Code implementation

**Model**: sonnet (capable)

**Tools**: Read, Write, Edit, Bash, Grep, Glob (full access)

**When to use**:
- Implementing features
- Fixing bugs
- Refactoring code

**Output format**:
```markdown
## Implementation Complete

### Files Modified
[Table: file, action, changes]

### Summary
[What was done]

### Verification
[How to verify it works]

### Notes
[Issues, decisions, follow-up]
```

---

### code-reviewer.md

**Purpose**: Quality and security review

**Model**: sonnet (thorough analysis)

**Tools**: Read, Grep, Glob, Bash (read + run tests)

**When to use**:
- After implementation
- Before merging
- Security audits

**Output format**:
```markdown
## Code Review: [Scope]

### Summary
[APPROVED | APPROVED_WITH_COMMENTS | CHANGES_REQUESTED]

### Critical Issues 🔴
[Must fix]

### Warnings 🟡
[Should fix]

### Suggestions 🟢
[Nice to have]

### Security Checklist
[Standard checks]

### What's Good
[Positive observations]
```

---

### test-writer.md

**Purpose**: Test creation

**Model**: sonnet (needs to understand code deeply)

**Tools**: Read, Write, Edit, Bash, Grep, Glob (full access)

**When to use**:
- After implementation
- Adding regression tests
- Improving coverage

**Output format**:
```markdown
## Tests Created

### Files Created/Modified
[Table: file, type, coverage]

### Test Summary
[Count, coverage areas]

### Test Cases
[List with descriptions]

### Running Tests
[Command]

### Notes
[Considerations]
```

---

### documentation-writer.md

**Purpose**: Documentation creation

**Model**: haiku (straightforward writing)

**Tools**: Read, Write, Edit, Grep, Glob (no bash needed)

**When to use**:
- After feature complete
- README updates
- API documentation

---

## Slash Commands

**Location**: `.claude/commands/`

### /project:feature

**File**: `feature.md`

**Purpose**: Complete feature development workflow

**Phases**:
1. Initialize state file
2. Research (researcher)
3. Plan (planner) + approval checkpoint
4. Implement (code-writer)
5. Test (test-writer)
6. Review (code-reviewer)
7. Document (documentation-writer)
8. Complete state file

**Usage**:
```
/project:feature Add user authentication with JWT tokens
```

---

### /project:bugfix

**File**: `bugfix.md`

**Purpose**: Bug investigation and fix

**Phases**:
1. Initialize state file
2. Investigate (researcher)
3. Diagnose (analysis in main thread)
4. Plan fix (planner)
5. Implement (code-writer)
6. Test (test-writer)
7. Verify (code-reviewer)
8. Complete

**Usage**:
```
/project:bugfix Users getting 500 error on file upload over 10MB
```

---

### /project:refactor

**File**: `refactor.md`

**Purpose**: Code improvement workflow

**Phases**:
1. Initialize
2. Analyze (researcher)
3. Plan (planner) + approval
4. Prepare tests (test-writer)
5. Refactor (code-writer)
6. Review (code-reviewer)
7. Complete

**Usage**:
```
/project:refactor Extract authentication logic into separate module
```

---

### /project:plan

**File**: `plan.md`

**Purpose**: Planning only (no execution)

**Phases**:
1. Research (researcher)
2. Plan (planner)
3. Present to user

**Usage**:
```
/project:plan Microservices architecture migration
```

---

### /project:review

**File**: `review.md`

**Purpose**: Review code changes

**Usage**:
```
/project:review recent           # Review uncommitted changes
/project:review src/auth/        # Review specific directory
```

---

### /project:logs:summary

**File**: `logs/summary.md`

**Purpose**: Human-readable log summary

**Usage**:
```
/project:logs:summary        # Last 10 entries
/project:logs:summary 25     # Last 25 entries
```

---

## Skills

**Location**: `.claude/skills/orchestration/`

### SKILL.md

The main skill file provides:
- Quick reference for task template structure
- Subagent selection guide
- Links to templates and examples

### Templates (6 files)

| Template | Purpose |
|----------|---------|
| `research-task.md` | Template for researcher subagent |
| `planning-task.md` | Template for planner subagent |
| `implementation-task.md` | Template for code-writer subagent |
| `review-task.md` | Template for code-reviewer subagent |
| `testing-task.md` | Template for test-writer subagent |
| `documentation-task.md` | Template for documentation-writer subagent |

Each template includes:
- The template structure
- Field explanations
- Concrete example

### Examples (2 files)

| Example | Purpose |
|---------|---------|
| `feature-decomposition.md` | Shows how to break down a feature request |
| `bugfix-decomposition.md` | Shows how to decompose a bug investigation |

---

## Hooks & Logging

**Location**: `.claude/settings.json`

### Configured Hooks

| Event | Matcher | Action |
|-------|---------|--------|
| PreToolUse | Task | Log subagent_start to JSONL |
| PostToolUse | Task | Log subagent_complete to JSONL |

### Log Format

**Location**: `.claude/logs/orchestration.jsonl`

Each line is a JSON object:
```json
{"timestamp": "2024-01-15T10:30:00-05:00", "event": "subagent_start", "tool": "Task"}
{"timestamp": "2024-01-15T10:30:45-05:00", "event": "subagent_complete", "tool": "Task"}
```

### Viewing Logs

```bash
# Raw logs
cat .claude/logs/orchestration.jsonl

# Pretty print
cat .claude/logs/orchestration.jsonl | jq .

# Filter by event
grep "subagent_start" .claude/logs/orchestration.jsonl | jq .

# Use the command
/project:logs:summary
```

---

## State Management

**Location**: `.claude/state/`

### State File Naming

Pattern: `{YYYY-MM-DD}_{task-slug}.md`

Examples:
- `2024-01-15_add-user-auth.md`
- `2024-01-15_bugfix_upload-500-error.md`
- `2024-01-16_refactor_auth-module.md`

### State File Structure

```markdown
# Orchestration: {Task Name}

**Started**: {ISO timestamp}
**Status**: IN_PROGRESS | COMPLETED | FAILED | PAUSED

## Original Request
{Exact user request}

## Decomposition
1. {Step} → {subagent}
2. {Step} → {subagent}

## Execution Log

### Step 1: {Description}
- **Subagent**: {name}
- **Status**: ⏳ | 🔄 | ✅ | ❌
- **Result Summary**: {when complete}
- **Files Modified**: {if applicable}
- **Notes**: {issues, observations}

## Final Summary
{When complete}
```

### Resuming Orchestration

If a session is interrupted:

1. Find the state file: `ls .claude/state/`
2. Review progress: `cat .claude/state/{file}.md`
3. Tell Claude: "Resume orchestration from .claude/state/{file}.md, continuing from step N"

---

## Customization Guide

### Adding a New Subagent

1. Create `.claude/agents/{name}.md`
2. Use this structure:

```markdown
---
name: {name}
description: {When to use this agent. Be specific.}
tools: {Comma-separated list}
model: haiku | sonnet | opus
---

# {Name} Agent

[Role description]

## Input Format
[What the agent expects]

## Output Format
[What the agent returns]

## Rules
[Agent-specific rules]
```

3. Add to CLAUDE.md's "Available Subagents" table
4. Create a template in `.claude/skills/orchestration/templates/`

### Adding a New Workflow

1. Create `.claude/commands/{workflow}.md`
2. Structure:

```markdown
---
description: {What this workflow does}
argument-hint: <expected arguments>
---

# {Workflow Name}

[Instructions for orchestrator]

## Phases
### Phase 1: ...
### Phase 2: ...

## Begin
Start with Phase 1 for: $ARGUMENTS
```

### Modifying Tool Access

Edit the `tools:` line in any subagent's frontmatter.

Available tools:
- `Read` - Read file contents
- `Write` - Create new files
- `Edit` - Modify existing files
- `Bash` - Run shell commands
- `Grep` - Search file contents
- `Glob` - Find files by pattern
- `Task` - Spawn subagents (main orchestrator only)

### Adjusting Model Selection

Edit the `model:` line in any subagent's frontmatter.

Options:
- `haiku` - Fast, cheap, good for simple tasks
- `sonnet` - Balanced, good for most work
- `opus` - Most capable, expensive
- `inherit` - Use main session's model

---

## Troubleshooting

### Subagent not being invoked

**Symptom**: Claude does something itself instead of delegating

**Fix**: 
1. Check CLAUDE.md is in project root
2. Verify agent file exists in `.claude/agents/`
3. Make description more specific with "Use proactively" language
4. Explicitly request: "Use the {name} subagent to..."

### State file not created

**Symptom**: No state tracking

**Fix**:
1. Verify `.claude/state/` directory exists
2. Check CLAUDE.md instructions mention state files
3. Use workflow commands which explicitly create state

### Logs not appearing

**Symptom**: Empty `.claude/logs/orchestration.jsonl`

**Fix**:
1. Verify `.claude/settings.json` is valid JSON
2. Check that hooks reference the `Task` tool
3. Ensure log directory exists: `mkdir -p .claude/logs`
4. Review hooks in Claude Code: `/hooks`

### Context bleeding between subagents

**Symptom**: Subagent seems to know things it shouldn't

**Reality**: This shouldn't happen—subagents get isolated context by design.

**If it does**:
1. The orchestrator may be including too much in the task prompt
2. Review the task template being used
3. Trim context to only essential information

### Orchestration feels slow

**Causes**:
1. Too many subagent invocations (each has ~20K overhead)
2. Using opus where sonnet would suffice
3. Tasks are too granular

**Fixes**:
1. Batch related work into single subagent calls
2. Use haiku for simple tasks
3. Combine steps that don't need isolation

---

## Quick Reference Card

### Commands
```
/project:feature <desc>     Full feature workflow
/project:bugfix <desc>      Bug investigation & fix
/project:refactor <desc>    Refactoring workflow
/project:plan <desc>        Planning only
/project:review <target>    Code review
/project:logs:summary [n]   View logs
```

### Subagents
```
researcher           Read-only exploration (haiku)
planner              Implementation planning (sonnet)
code-writer          Code implementation (sonnet)
code-reviewer        Quality review (sonnet)
test-writer          Test creation (sonnet)
documentation-writer Documentation (haiku)
```

### Key Files
```
CLAUDE.md                           Orchestrator brain
.claude/agents/                     Subagent definitions
.claude/commands/                   Workflow commands
.claude/skills/orchestration/       Templates & examples
.claude/state/                      Orchestration state
.claude/logs/                       Activity logs
.claude/settings.json               Hooks config
```
