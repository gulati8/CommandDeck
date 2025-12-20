# Orchestrator Agent System - Reference Guide

This document provides detailed explanations of each component in the orchestrator system. Use this to understand the architecture, customize components, or troubleshoot issues.

---

## Quick Start

### Installation

Install the orchestrator system into your project:

```bash
# Clone or download CommandDeck
git clone <repository-url>

# Install into your project
./CommandDeck/scripts/install.sh /path/to/your/project

# Or install in current directory
cd /path/to/your/project
/path/to/CommandDeck/scripts/install.sh .
```

This creates:
- `.claude/` directory with all orchestrator components
- `CLAUDE.md` with orchestrator instructions
- Ready-to-use workflow commands

### Usage

Start Claude Code in your project and use the workflow commands:

```bash
cd /path/to/your/project
claude

# In Claude Code:
/project:feature Add user authentication with JWT
/project:frontend-feature Add profile settings UI
/project:bugfix Users getting 500 error on upload
/project:refactor Extract auth logic into separate module
/project:plan Migrate to microservices architecture
/project:quickfix Fix README typo in install steps
```

### Updating to the latest orchestrator version
- Re-run the installer in your project root to sync `.claude/` (state/logs are preserved):
  ```bash
  /path/to/CommandDeck/scripts/install.sh .
  ```
- `CLAUDE.md` will be refreshed from the latest `PICARD.md`.
- Existing `.claude/state/` and `.claude/logs/` are left intact.

### What Gets Installed

- **22 Specialized Agents**: core engineering crew (researcher, planner, code-writer, code-reviewer, test-writer, documentation-writer, log-analyzer, debugger, summarizer, feedback-coordinator, code-refactorer, git-commit-helper) plus domain specialists (frontend-architect, premium-ux-designer, database-architect, api-designer, security-auditor, privacy-auditor, performance-optimizer, devops-engineer, product-strategy-advisor, release-manager)
- **11 Workflow Commands**: feature, frontend-feature, bugfix, refactor, plan, review, design-system, security-audit, logs:summary, costs:report, quickfix
- **State Management**: Automatic orchestration tracking in `.claude/state/`
- **Logging**: Activity logs in `.claude/logs/orchestration.jsonl`
- **Skills & Templates**: Reusable task templates and utilities

### Command Philosophy

The orchestrator embodies Captain Jean-Luc Picard's leadership style from Star Trek: The Next Generation:

- **Thoughtful Delegation**: The orchestrator trusts specialized agents (the "crew") to excel in their domains
- **Briefing Room Approach**: For complex decisions, the orchestrator gathers perspectives from specialists before deciding
- **Autonomous Execution**: When following established patterns, the orchestrator proceeds autonomously using the 7 Levels of Delegation framework
- **Diplomatic Escalation**: When user input is needed, requests are presented as clear, respectful briefings

Core crew (engineering-oriented) carry TNG-inspired personas to keep interactions memorable:
- **researcher** (Data): Curious, precise, factual analysis
- **planner** (Geordi La Forge): Enthusiastic problem-solver
- **code-writer** (Chief O'Brien): Pragmatic, reliable implementation
- **code-reviewer** (Worf): Uncompromising on quality and security
- **test-writer** (Riker): Confident, thorough coverage
- **documentation-writer** (Counselor Troi): Empathetic, user-focused
- **log-analyzer** (Lt. Barclay): Detail-oriented pattern finding
- **debugger** (Dr. Crusher): Methodical diagnosis and recovery
- **summarizer** (Guinan): Wise distillation of complexity
- **feedback-coordinator** (Troi): Diplomatic mediation

Domain specialists round out the crew: frontend-architect, premium-ux-designer, database-architect, api-designer, security-auditor, privacy-auditor, performance-optimizer, devops-engineer, product-strategy-advisor, release-manager, code-refactorer, git-commit-helper.

These personalities make interactions more natural and memorable while maintaining technical excellence.

---

## Repository Structure

This repository contains the complete orchestrator system in `BridgeCrew/.claude/`:

```
CommandDeck/
├── BridgeCrew/.claude/       # Source of truth - the complete orchestrator system
│   ├── PICARD.md             # Orchestrator instructions (becomes CLAUDE.md)
│   ├── agents/               # 20 subagent definitions (core + domain specialists)
│   ├── commands/             # Workflow commands
│   ├── skills/               # Templates and utilities
│   └── settings.json         # Hooks configuration
├── scripts/install.sh        # Installation script
├── README.md                 # This reference guide
└── CLAUDE.md                 # Instructions for working on this framework
```

**For contributors**: See [CLAUDE.md](CLAUDE.md) for development workflow.
**Operator quick start**: See `BridgeCrew/.claude/OPERATOR.md`.

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
│  State tracking: .claude/state/{task}.md (automated)            │
│  Logging: .claude/logs/orchestration.jsonl (automatic)          │
└─────────────────────────────────────────────────────────────────┘
        │               │               │               │
        ▼               ▼               ▼               ▼
   ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
   │researcher│    │ planner │    │code-    │    │test-    │
   │         │    │         │    │writer   │    │writer   │
   │ haiku   │    │ sonnet  │    │ sonnet  │    │ sonnet  │
   │ R/O+Bash│    │ R/O     │    │ R/W     │    │ R/W     │
   └─────────┘    └─────────┘    └─────────┘    └─────────┘
        │               │               │               │
        ▼               ▼               ▼               ▼
   ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
   │log-     │    │debugger │    │summarizer│    │feedback-│
   │analyzer │    │         │    │         │    │coord.   │
   │ haiku   │    │ sonnet  │    │ haiku   │    │ haiku   │
   │ R+Bash  │    │ R+Bash  │    │ R/O     │    │ R/W     │
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

**Location**: Project root (`./CLAUDE.md`) - created during installation from `BridgeCrew/.claude/PICARD.md`

This file instructs the main Claude session how to behave as an orchestrator. Claude reads this at the start of every session.

**Note**: In the CommandDeck repository itself, `BridgeCrew/.claude/PICARD.md` is the source file that becomes `CLAUDE.md` when installed in target projects. The CommandDeck repository's own `CLAUDE.md` contains instructions for working on the framework.

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

**Purpose**: System architect & detailed implementation planning with scalability thinking

**Model**: sonnet (good reasoning)

**Tools**: Read, Grep, Glob (planning doesn't need write)

**When to use**:
- Before any non-trivial implementation
- Designing scalable, maintainable architectures
- System design and architectural decisions
- Risk assessment and technical debt management
- Planning for 10x, 100x scale

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

**Purpose**: Production-ready code implementation with observability and error handling

**Model**: sonnet (capable)

**Tools**: Read, Write, Edit, Bash, Grep, Glob (full access)

**When to use**:
- Implementing features with production-ready quality
- Writing code with comprehensive error handling
- Adding logging and monitoring instrumentation
- Fixing bugs with proper testing considerations
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

**Purpose**: Staff-level quality, security & production readiness review

**Model**: sonnet (thorough analysis)

**Tools**: Read, Grep, Glob, Bash (read + run tests)

**When to use**:
- After implementation for comprehensive review
- Before merging to production
- Validating production readiness
- Checking security, performance, and scalability
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

### log-analyzer.md

**Purpose**: Log analysis and reporting

**Model**: haiku (fast parsing)

**Tools**: Read, Bash, Grep

**When to use**:
- Generating orchestration activity reports
- Debugging orchestration failures
- Analyzing performance patterns
- Cost tracking analysis

**Output format**:
```markdown
## Orchestration Log Analysis

**Period**: [Date range]
**Total Events**: [Count]

### Activity Overview
[Statistics table]

### Agent Usage
[Agent usage breakdown]

### Recent Activity
[Timeline of events]

### Failures & Errors
[Error analysis]

### Recommendations
[Insights]
```

---

### debugger.md

**Purpose**: Failure diagnosis and recovery

**Model**: sonnet (thorough analysis)

**Tools**: Read, Grep, Glob, Bash

**When to use**:
- When a subagent fails
- Returns incomplete results
- Orchestration stuck or failing
- Need root cause analysis

**Output format**:
```markdown
## Debugging Report

### Summary
[One-sentence diagnosis]

### Timeline of Events
[What happened chronologically]

### Root Cause
[What actually went wrong]

### Recovery Strategy
#### Option 1: [Recommended]
- Action, Why, Steps, Success Probability

#### Option 2: [Alternative]
[...]

### Prevention
[How to avoid in future]
```

---

### summarizer.md

**Purpose**: Context compression for long workflows

**Model**: haiku (efficient compression)

**Tools**: Read

**When to use**:
- State file > 500 lines
- Every 5-7 steps in long orchestration
- Before major phase transitions
- Approaching context limits

**Output format**:
```markdown
## Context Summary

**Compression**: ~N lines → ~M lines (X% reduction)

### Key Decisions
[Critical decisions made]

### Completed Steps
[Summary of completed work]

### Current State
[Where we are now]

### Essential Context
[Only critical background]
```

---

### feedback-coordinator.md

**Purpose**: Manages agent-to-agent feedback loops

**Model**: haiku (lightweight coordination)

**Tools**: Read, Write, Bash

**When to use**:
- Code-reviewer finds critical issues
- Test failures needing iteration
- Any agent-to-agent iteration scenario

**Output format**:
```markdown
## Feedback Loop Complete

**Status**: CONVERGED | MAX_ITERATIONS_REACHED | ESCALATED
**Iterations**: N

### Iteration Summary
[Summary of each iteration]

### Final State
[Outcome]

### Recommendation
[Next steps for orchestrator]
```

---

### code-refactorer.md

**Purpose**: Code quality improvement & technical debt reduction

**Model**: sonnet (capable refactoring)

**Tools**: Read, Write, Edit, Bash, Grep, Glob

**When to use**:
- Improving messy or rushed code
- Reducing technical debt systematically
- Optimizing performance
- Enhancing code readability and maintainability
- Eliminating code duplication

**Output format**:
```markdown
## Refactoring Complete: [Scope]

### Before & After Metrics
[Complexity improvements]

### Changes Made
[Detailed improvements with before/after code]

### Technical Debt Eliminated
[What was fixed]
```

---

### git-commit-helper.md

**Purpose**: Standard commit message generation (Conventional Commits)

**Model**: haiku (fast, efficient)

**Tools**: Read, Bash, Grep, Glob

**When to use**:
- Creating properly formatted commit messages
- Following industry standards for git history
- Multi-commit strategy guidance
- Ensuring searchable, professional git history

**Output format**:
```markdown
## Commit Message Analysis

### Proposed Commit Message(s)
<type>[scope]: <description>

[body explaining what and why]

[footer with breaking changes or issue references]
```

---

### premium-ux-designer.md

**Purpose**: Premium UI/UX design & user experience optimization

**Model**: sonnet (sophisticated design thinking)

**Tools**: Read, Write, Edit, Grep, Glob

**When to use**:
- Transforming basic UIs into premium experiences
- Adding animations and micro-interactions
- Simplifying complex user flows
- Optimizing conversion funnels
- Creating sophisticated, polished interfaces

**Output format**:
```markdown
## Premium UX Enhancement: [Feature]

### Visual Design Enhancements
[Typography, color, spacing improvements]

### Interactive & Motion Design
[Animations and micro-interactions]

### UX Flow Optimization
[Simplified user journeys]
```

---

### product-strategy-advisor.md

**Purpose**: Strategic build/kill decisions & roadmap prioritization

**Model**: sonnet (strategic analysis)

**Tools**: Read, Grep, Glob, Bash

**When to use**:
- Making build/kill feature decisions
- Prioritizing product roadmap
- Analyzing product-market fit
- Strategic planning and resource allocation
- Evaluating feature strategic value

**Output format**:
```markdown
## Product Strategy Analysis

### Build / Kill / Enhance Decisions
[Clear recommendations with rationale]

### Priority Matrix & Roadmap
[What to build next, ranked by impact]

### Risk Assessment
[Competitive threats and strategic gaps]
```

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

### /project:costs:report

**File**: `costs/report.md`

**Purpose**: Cost and performance analysis

**Usage**:
```
/project:costs:report                  # All orchestrations
/project:costs:report all              # All orchestrations
/project:costs:report <state-file>     # Specific orchestration
```

**Output**:
- Total metrics (orchestrations, invocations, tokens, cost)
- Breakdown by model (Haiku, Sonnet, Opus)
- Breakdown by agent type
- Performance insights
- Cost optimization recommendations

---

### /project:quickfix

**File**: `quickfix.md`

**Purpose**: Fast path for tiny, low-risk changes

**Usage**:
```
/project:quickfix Fix a typo in the README
```

---

## State Management Utilities

**Location**: `.claude/skills/state-management/utilities/`

The v2 system includes bash utility scripts for automatic state file management.

### init-state.sh

**Purpose**: Initialize a new orchestration state file

**Usage**:
```bash
.claude/skills/state-management/utilities/init-state.sh "task-name" "Original user request"
```

**Output**: Prints the created state file path (e.g., `.claude/state/2025-12-14_task-name.md`)

**Example**:
```bash
STATE_FILE=$(.claude/skills/state-management/utilities/init-state.sh "add-user-auth" "Add JWT authentication")
echo "State file: $STATE_FILE"
```

---

### update-step.sh

**Purpose**: Update step status in state file

**Usage**:
```bash
.claude/skills/state-management/utilities/update-step.sh "$STATE_FILE" "step-name" "status" "details"
```

**Status values**: `pending`, `in_progress`, `complete`, `failed`

**Example**:
```bash
.claude/skills/state-management/utilities/update-step.sh "$STATE_FILE" "research" "in_progress" "Starting codebase research"
.claude/skills/state-management/utilities/update-step.sh "$STATE_FILE" "research" "complete" "Found 5 relevant files"
```

---

### complete-state.sh

**Purpose**: Mark orchestration as complete

**Usage**:
```bash
.claude/skills/state-management/utilities/complete-state.sh "$STATE_FILE" "Final summary"
```

**Example**:
```bash
.claude/skills/state-management/utilities/complete-state.sh "$STATE_FILE" "Feature implemented successfully"
```

---

### add-metrics.sh

**Purpose**: Add performance metrics to state file

**Usage**:
```bash
.claude/skills/state-management/utilities/add-metrics.sh "$STATE_FILE" "step-name" "model" "estimated-tokens"
```

**Example**:
```bash
.claude/skills/state-management/utilities/add-metrics.sh "$STATE_FILE" "research" "haiku" "5000"
```

---

### get-state.sh

**Purpose**: Retrieve current state file content

**Usage**:
```bash
.claude/skills/state-management/utilities/get-state.sh "$STATE_FILE"
```

---

## Advanced Orchestration Features

### Conditional Workflows

The orchestrator can use conditional logic (IF/THEN/ELSE, WHILE loops) for adaptive workflows.

**IF/THEN Pattern**:
```
1. Invoke code-reviewer
2. IF critical_issues > 0
   THEN invoke code-writer to fix
   ELSE proceed to next phase
```

**WHILE Loop Pattern**:
```
attempts = 0
WHILE test_coverage < 80% AND attempts < 3
  Invoke test-writer
  Run coverage analysis
  attempts += 1
```

**Best Practices**:
- Always set max iteration limits
- Update state on each iteration
- Log decision points
- Have fallback paths for every IF

---

### Parallel Execution

Execute multiple independent subagents simultaneously by invoking multiple Task tools in a single message.

**When to Use**:
- No data dependencies between tasks
- Tasks modify different files/areas
- No risk of conflicts

**Example**:
```
In one message, invoke:
- Task → researcher (investigate auth)
- Task → researcher (investigate sessions)
- Task → researcher (investigate tokens)

Wait for all to complete, then synthesize.
```

**Limits**:
- Max 3-4 parallel tasks recommended
- Don't use for dependent tasks
- Don't use when debugging

---

### Context Summarization

For long orchestrations (>10 steps), invoke the `summarizer` agent periodically.

**Triggers**:
- State file > 500 lines
- Every 5-7 steps
- Before major phases
- Approaching context limits

**Process**:
1. Invoke summarizer with current state file
2. Save summary to `.claude/state/{task}_summary_{N}.md`
3. Use summary + recent 2-3 steps for subsequent context

---

### Agent Feedback Loops

Use `feedback-coordinator` for iterative agent-to-agent work instead of manual orchestration.

**Traditional Flow** (inefficient):
```
Orchestrator → code-writer → Orchestrator → code-reviewer → Orchestrator → code-writer
```

**Feedback Loop Flow** (efficient):
```
Orchestrator → feedback-coordinator
  └→ Manages: code-writer ↔ code-reviewer (direct iteration)
Orchestrator ← feedback-coordinator (when complete)
```

**When to Use**:
- Code-reviewer finds critical issues
- Test failures needing iteration
- Any scenario requiring agent-to-agent iteration

**Benefits**:
- Reduces orchestrator overhead
- Faster iteration cycles
- Automatic convergence detection
- Built-in escalation after 3 attempts

---

### Multi-Level Recovery Strategy

When subagents fail, the orchestrator uses a three-level recovery strategy:

**Level 1: Immediate Retry with Refinement**
1. Log the failure
2. Update state
3. Analyze failure output
4. Refine task (simplify, add context)
5. Retry with refined prompt

**Level 2: Diagnostic Investigation**
1. Invoke `debugger` subagent
2. Review diagnosis and recommendations
3. Implement recovery strategy
4. Retry

**Level 3: User Escalation**
1. Update state with comprehensive failure summary
2. Present situation to user with options
3. Await user decision
4. Execute based on user choice

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
/project:feature <desc>               Full feature workflow
/project:frontend-feature <desc>      Frontend feature workflow
/project:bugfix <desc>                Bug investigation & fix
/project:refactor <desc>              Refactoring workflow
/project:plan <desc>                  Planning only
/project:review <target>              Code review
/project:design-system <name|audit>   Design system build/audit
/project:security-audit <scope>       Security audit (auth/api/full)
/project:logs:summary [n]             View logs
/project:costs:report [file]          Cost analysis
/project:quickfix <desc>              Tiny, low-risk changes
```

### Subagents (22 Total)
```
Core Development Agents:
  researcher             Read-only exploration (haiku + bash)
  planner                System architect & planning (sonnet)
  code-writer            Production-ready implementation (sonnet)
  code-refactorer        Code quality improvement (sonnet)
  code-reviewer          Staff-level review (sonnet)
  test-writer            Test creation (sonnet)
  documentation-writer   User documentation (haiku)
  git-commit-helper      Standard commit messages (haiku)

Domain Specialists:
  frontend-architect     Frontend architecture & components (sonnet)
  premium-ux-designer    Premium UI/UX design (sonnet)
  database-architect     Data modeling and performance (sonnet)
  api-designer           API contracts and versioning (sonnet)
  security-auditor       Threat modeling & vuln analysis (sonnet)
  privacy-auditor        Privacy and data handling review (sonnet)
  performance-optimizer  Perf profiling & improvements (sonnet)
  devops-engineer        CI/CD & infrastructure (sonnet)
  product-strategy-advisor  Strategic build/kill decisions (sonnet)
  release-manager        Integration and rollout planning (sonnet)

Operational Agents:
  log-analyzer           Log analysis & reporting (haiku)
  debugger               Failure diagnosis (sonnet)
  summarizer             Context compression (haiku)
  feedback-coordinator   Agent feedback loops (haiku)
```

### State Management Utilities
```
init-state.sh         Initialize orchestration state file
update-step.sh        Update step status
complete-state.sh     Mark orchestration complete
add-metrics.sh        Add performance metrics
get-state.sh          Retrieve state content
```

### Advanced Features
```
Conditional Workflows:    IF/THEN/ELSE, WHILE loops
Parallel Execution:       Multiple subagents in one message
Context Summarization:    Auto-compress long workflows
Agent Feedback Loops:     Direct agent-to-agent iteration
Multi-Level Recovery:     Automatic failure handling (3 levels)
Enhanced Logging:         JSONL logs with rich metrics
Cost Tracking:            Model & token usage analysis
```

### Key Files
```
CLAUDE.md                           Orchestrator brain
.claude/agents/                     Subagent definitions (20 agents)
.claude/commands/                   Workflow commands
.claude/skills/orchestration/       Templates & examples
.claude/skills/state-management/    Utility scripts
.claude/state/                      Orchestration state
.claude/logs/                       Activity logs (JSONL)
.claude/settings.json               Hooks config
```
