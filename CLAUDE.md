# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Repository Is

This is **CommandDeck** - a Claude Code orchestrator agent system framework. It's not an application to be developed, but rather a tool that provides a complete orchestrator system for other projects.

The repository contains:
- `BridgeCrew/.claude/` - The complete orchestrator system (source of truth)
- `scripts/install.sh` - Installation script for deploying to target projects
- `README.md` - Detailed reference documentation for the orchestrator architecture
- `setup-orchestrator.sh` - Legacy single-file installer (maintained for compatibility)

## Key Architecture Concepts

### The Orchestrator Pattern
This system implements a delegation-based architecture where:
- The **main Claude session** acts as an orchestrator (coordinator)
- **Specialized subagents** (via the Task tool) perform all actual work
- **State files** (.claude/state/) track progress across sessions
- **JSONL logs** (.claude/logs/) record all orchestration events

### Design Philosophy
1. **Avoid subagent nesting** - Main session orchestrates, subagents execute (saves 20K tokens per invocation)
2. **Isolated context** - Each subagent receives only what's explicitly provided
3. **Model tiering** - Use haiku for simple tasks, sonnet for complex work
4. **Structured communication** - Markdown templates for task delegation

## Working With This Repository

### Development Workflow

All orchestrator system files are maintained directly in `BridgeCrew/.claude/`. This is the source of truth.

**To make changes:**

1. Edit files directly in `BridgeCrew/.claude/`
   - `BridgeCrew/.claude/agents/` - Subagent definitions
   - `BridgeCrew/.claude/commands/` - Workflow commands
   - `BridgeCrew/.claude/skills/` - Templates and utilities
   - `BridgeCrew/.claude/PICARD.md` - Main orchestrator instructions (becomes CLAUDE.md when installed)

2. Test locally:
   ```bash
   # Install to a test project
   ./scripts/install.sh /path/to/test/project

   # Or test in tmp
   ./scripts/install.sh /tmp/test-orchestrator
   cd /tmp/test-orchestrator
   claude
   ```

3. Commit changes:
   ```bash
   git add TheFederation/
   git commit -m "Update agent definitions"
   ```

### Installing Into A Project

Users can install the orchestrator system in two ways:

**Method 1: Direct installation (recommended)**
```bash
# From the CommandDeck repo
./scripts/install.sh /path/to/target/project
```

**Method 2: Clone and copy**
```bash
git clone <repo>
cp -r CommandDeck/BridgeCrew/.claude /path/to/target/project/
mv /path/to/target/project/.claude/PICARD.md /path/to/target/project/CLAUDE.md
```

This creates in the target project:
- `.claude/agents/` - 10 specialized subagent definitions
- `.claude/commands/` - Workflow commands (/project:feature, /project:bugfix, etc.)
- `.claude/skills/` - Templates and utilities
- `.claude/state/` - Orchestration state tracking
- `.claude/logs/` - Activity logs
- `.claude/settings.json` - Hooks configuration
- `CLAUDE.md` - Main orchestrator instructions (from PICARD.md)

## The 10 Subagents

| Agent | Purpose | Model | File |
|-------|---------|-------|------|
| researcher | Read-only codebase exploration | haiku | `agents/researcher.md` |
| planner | Implementation planning | sonnet | `agents/planner.md` |
| code-writer | Code implementation | sonnet | `agents/code-writer.md` |
| code-reviewer | Quality and security review | sonnet | `agents/code-reviewer.md` |
| test-writer | Test creation | sonnet | `agents/test-writer.md` |
| documentation-writer | Documentation writing | haiku | `agents/documentation-writer.md` |
| log-analyzer | Log analysis and reporting | haiku | `agents/log-analyzer.md` |
| debugger | Failure diagnosis and recovery | sonnet | `agents/debugger.md` |
| summarizer | Context compression for long workflows | haiku | `agents/summarizer.md` |
| feedback-coordinator | Agent-to-agent feedback loops | haiku | `agents/feedback-coordinator.md` |

## Workflow Commands

The system includes pre-built workflow commands:
- `/project:feature <description>` - Full feature development workflow
- `/project:bugfix <description>` - Bug investigation and fix
- `/project:refactor <description>` - Code refactoring workflow
- `/project:plan <description>` - Planning only (no execution)
- `/project:review <target>` - Code review
- `/project:logs:summary [n]` - View orchestration logs
- `/project:costs:report [file]` - Cost and performance analysis

## Making Changes To The System

### Adding a New Subagent

1. Create `BridgeCrew/.claude/agents/your-agent.md`:

```markdown
---
name: your-agent
description: When to use this agent. Be specific about use cases.
tools: Read, Write, Edit, Bash, Grep, Glob
model: haiku | sonnet | opus
---

# Your Agent

Role and responsibilities.

## Input Format
What this agent expects to receive.

## Output Format
What this agent returns.

## Rules
Agent-specific constraints and guidelines.
```

2. Update `BridgeCrew/.claude/PICARD.md` to include the new agent in the "Available Subagents" table

3. Optionally add a task template in `BridgeCrew/.claude/skills/orchestration/templates/`

4. Test by installing to a test project

### Adding a New Workflow Command

1. Create `BridgeCrew/.claude/commands/your-workflow.md`:

```markdown
---
description: What this workflow does
argument-hint: <expected arguments>
---

# Your Workflow

Instructions for the orchestrator on how to execute this workflow.

## Phases
1. Phase 1: Initialize and research
2. Phase 2: Execute main work
3. Phase 3: Verify and complete

## Begin
Execute Phase 1 for: $ARGUMENTS
```

2. Test with `/your-workflow <args>` in a test project

### Modifying Existing Agents

Simply edit the agent file directly in `BridgeCrew/.claude/agents/`. Changes include:

**Changing model assignment:**
Edit the `model:` frontmatter field (options: haiku, sonnet, opus, inherit)

**Modifying tool access:**
Edit the `tools:` frontmatter field (available: Read, Write, Edit, Bash, Grep, Glob)

**Updating instructions:**
Edit the agent's markdown body

### Customizing State Management

The bash utility scripts are in `BridgeCrew/.claude/skills/state-management/utilities/`:
- `init-state.sh` - Initialize orchestration state file
- `update-step.sh` - Update step status
- `complete-state.sh` - Mark orchestration complete
- `add-metrics.sh` - Add performance metrics
- `get-state.sh` - Retrieve state content

Edit these scripts directly to customize behavior.

### Modifying Settings and Hooks

Edit `BridgeCrew/.claude/settings.json` to adjust:
- Logging behavior (PreToolUse/PostToolUse hooks)
- Event tracking
- Hook matchers

## Testing Changes

After editing files in `BridgeCrew/.claude/`:

```bash
# Test in a temporary project
./scripts/install.sh /tmp/test-orchestrator

# Navigate and test
cd /tmp/test-orchestrator
claude

# Try a workflow
/project:plan Add user authentication
```

## Repository Structure

```
CommandDeck/
├── README.md                      # Reference documentation
├── CLAUDE.md                      # This file (for working on framework)
├── BridgeCrew/                    # The orchestrator system (SOURCE OF TRUTH)
│   └── .claude/
│       ├── PICARD.md             # Orchestrator instructions (→ CLAUDE.md)
│       ├── agents/               # 10 subagent definitions
│       │   ├── researcher.md
│       │   ├── planner.md
│       │   └── ...
│       ├── commands/             # Workflow commands
│       │   ├── feature.md
│       │   ├── bugfix.md
│       │   └── ...
│       ├── skills/               # Templates and utilities
│       │   ├── orchestration/
│       │   └── state-management/
│       ├── settings.json         # Hooks configuration
│       ├── state/                # (empty, created on install)
│       └── logs/                 # (empty, created on install)
├── scripts/
│   └── install.sh                # Installation script
├── setup-orchestrator.sh         # Legacy installer (maintained)
└── .claude/                      # Local testing (gitignored)
```

## Why "BridgeCrew" and "PICARD.md"?

- **BridgeCrew**: The specialized team working together on the bridge - each agent has a specific role
- **PICARD.md**: "Make it so" - the captain's orders that coordinate the bridge crew (becomes CLAUDE.md when installed)

## Important Notes

1. **BridgeCrew/.claude/ is the source of truth** - All changes should be made directly to files here
2. **Edit real files, not heredocs** - This is much easier for both humans and Claude to work with
3. **Test before committing** - Always install to a test project and verify changes work
4. **PICARD.md becomes CLAUDE.md** - The install script renames it during installation
5. **setup-orchestrator.sh is maintained** - Update it periodically for users who prefer single-file distribution
6. **Local .claude/ is gitignored** - Use it for testing without polluting the repo

## Common Tasks

**Add a new agent:**
```bash
# Create the agent file
cat > BridgeCrew/.claude/agents/new-agent.md << 'EOF'
[agent definition]
EOF

# Update PICARD.md to reference it
# Test the installation
./scripts/install.sh /tmp/test && cd /tmp/test && claude
```

**Modify an existing agent:**
```bash
# Edit directly
vim BridgeCrew/.claude/agents/researcher.md

# Test
./scripts/install.sh /tmp/test
```

**Update a workflow:**
```bash
# Edit the command file
vim BridgeCrew/.claude/commands/feature.md

# Test with the workflow
./scripts/install.sh /tmp/test
cd /tmp/test && claude
/project:feature <test case>
```
