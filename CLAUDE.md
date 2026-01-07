# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Repository Is

This is **CommandDeck** - a Claude Code orchestrator agent system framework. It's not an application to be developed, but rather a tool that provides a complete orchestrator system for other projects.

The repository contains:
- `BridgeCrew/.claude/` - The complete orchestrator system (source of truth)
- `BridgeCrew/.codex/` - Codex-friendly orchestration assets
- `scripts/install.sh` - Installation script for deploying to target projects
- `scripts/codex-*.sh` - Codex workflow helpers (installed to target `.codex/scripts/`)
- `README.md` - Detailed reference documentation for the orchestrator architecture

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
   - `BridgeCrew/.claude/agents/` - Core agents and packs (installed by default)
   - `BridgeCrew/.claude/commands/` - Workflow commands
   - `BridgeCrew/.claude/skills/` - Templates and utilities
- `BridgeCrew/.claude/ORCHESTRATOR.md` - Main orchestrator instructions (referenced by installed CLAUDE.md)

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
   git add BridgeCrew/
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
cat << 'EOF' >> /path/to/target/project/CLAUDE.md
# CommandDeck Orchestrator

Follow the orchestration instructions in:
- .claude/ORCHESTRATOR.md

# End CommandDeck Orchestrator
EOF
```
If `CLAUDE.md` already contains the CommandDeck Orchestrator block, do not add it again.

This creates in the target project:
- `.claude/agents/` - Core agents + packs (installed by default)
- `.claude/commands/` - Workflow commands (/project:feature, /project:bugfix, /project:refactor, /project:plan, /project:review, /project:quickfix, /project:lite-feature, /project:lite-bugfix, etc.)
- `.claude/skills/` - Templates and utilities
- `.claude/state/` - Orchestration state tracking
- `.claude/logs/` - Activity logs
- `.claude/settings.json` - Hooks configuration
- `CLAUDE.md` - Project instructions with reference to ORCHESTRATOR.md
- `.codex/ORCHESTRATOR_CODEX.md` - Codex workflow instructions
- `.codex/scripts/` - Codex workflow helpers
- `AGENTS.md` - Codex instructions with reference to ORCHESTRATOR_CODEX.md

## Core Subagents

| Agent | Purpose | Model | File |
|-------|---------|-------|------|
| researcher | Read-only codebase exploration | haiku | `agents/core/researcher.md` |
| planner | Implementation planning | sonnet | `agents/core/planner.md` |
| code-writer | Code implementation | sonnet | `agents/core/code-writer.md` |
| code-reviewer | Quality and security review | sonnet | `agents/core/code-reviewer.md` |
| test-writer | Test creation | sonnet | `agents/core/test-writer.md` |
| debugger | Failure diagnosis and recovery | sonnet | `agents/core/debugger.md` |
| summarizer | Context compression for long workflows | haiku | `agents/core/summarizer.md` |

### Packs (installed by default)

- Frontend: `agents/packs/frontend/`
- Backend: `agents/packs/backend/`
- Security: `agents/packs/security/`
- Infra: `agents/packs/infra/`
- Quality: `agents/packs/quality/`
- DevEx: `agents/packs/devex/`
- Product: `agents/packs/product/`
- Ops: `agents/packs/ops/`

## Workflow Commands

The system includes pre-built workflow commands:
- `/project:feature <description>` - Full feature development workflow
- `/project:bugfix <description>` - Bug investigation and fix
- `/project:refactor <description>` - Code refactoring workflow
- `/project:plan <description>` - Planning only (no execution)
- `/project:review <target>` - Code review
- `/project:logs:summary [n]` - View orchestration logs
- `/project:costs:report [file]` - Cost and performance analysis
- `/project:lite-feature <description>` - Lightweight feature workflow
- `/project:lite-bugfix <description>` - Lightweight bugfix workflow

## Making Changes To The System

### Adding a New Subagent

1. Create `BridgeCrew/.claude/agents/packs/<pack>/your-agent.md` (or `agents/core/` if it is core):

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

2. Update `BridgeCrew/.claude/ORCHESTRATOR.md` to include the new agent in the "Available Subagents" section

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

Simply edit the agent file directly in `BridgeCrew/.claude/agents/core/` or `BridgeCrew/.claude/agents/packs/<pack>/`. Changes include:

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
│       ├── ORCHESTRATOR.md       # Orchestrator instructions (→ CLAUDE.md)
│       ├── agents/               # Core agents + packs (installed by default)
│       │   ├── core/
│       │   ├── packs/
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
│   └── .codex/
│       └── ORCHESTRATOR_CODEX.md # Codex workflow instructions (→ AGENTS.md)
├── scripts/
│   └── install.sh                # Installation script
│   └── codex-*.sh                 # Codex workflow helpers
└── .claude/                      # Local testing (gitignored)
```

## Important Notes

1. **BridgeCrew/.claude/ is the source of truth** - All changes should be made directly to files here
2. **Edit real files, not heredocs** - This is much easier for both humans and Claude to work with
3. **Test before committing** - Always install to a test project and verify changes work
4. **ORCHESTRATOR.md is referenced by CLAUDE.md** - The install script appends a reference during installation
5. **Local .claude/ is gitignored** - Use it for testing without polluting the repo

## Common Tasks

**Add a new agent:**
```bash
# Create the agent file
cat > BridgeCrew/.claude/agents/packs/<pack>/new-agent.md << 'EOF'
[agent definition]
EOF

# Update ORCHESTRATOR.md to reference it
# Test the installation
./scripts/install.sh /tmp/test && cd /tmp/test && claude
```

**Modify an existing agent:**
```bash
# Edit directly
vim BridgeCrew/.claude/agents/core/researcher.md

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
