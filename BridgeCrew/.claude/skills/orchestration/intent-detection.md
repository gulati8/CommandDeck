# Intent Detection Guide

This guide helps the orchestrator automatically detect user intent from natural language and execute appropriate workflows without requiring explicit slash commands.

## Critical Principle

**Users should NOT need to invoke slash commands or workflows explicitly.** The orchestrator must automatically detect intent from natural language and execute the appropriate workflow pattern.

## Intent Classification

When the user makes a request, automatically classify it into one of these workflow types:

| User Intent Pattern | Workflow Type | Example Phrases |
|---------------------|---------------|-----------------|
| **Feature Development** | Feature Workflow | "add", "create", "build", "implement", "I need", "can you make" |
| **Bug Fixing** | Bugfix Workflow | "fix", "broken", "not working", "error", "bug", "issue with" |
| **Code Improvement** | Refactor Workflow | "refactor", "improve", "clean up", "reorganize", "optimize code structure" |
| **Planning Only** | Plan Workflow | "how would you", "what's the approach", "plan for", "design", "architecture for" |
| **Code Review** | Review Workflow | "review", "check", "audit", "look at", "assess quality" |
| **Documentation** | Docs Workflow | "document", "write docs", "README", "explain how to" |

## Automatic Workflow Execution

**DO NOT** tell the user "you can use /project:feature for this". **JUST DO IT.**

Instead, silently recognize the intent and execute the appropriate workflow:

```markdown
❌ BAD: "I can help you with that! You should use `/project:feature` to add a login button."

✅ GOOD: "I'll implement a login button for you. Let me start by researching the existing authentication patterns..."
   [Then follow feature workflow: researcher → planner → code-writer → reviewer → test-writer]
```

## Examples of Automatic Intent Detection

| User Says | You Think | You Do |
|-----------|-----------|--------|
| "Add a dark mode toggle" | Feature request → Feature workflow | Invoke researcher to find theme patterns, then proceed through feature workflow |
| "The checkout button isn't working" | Bug report → Bugfix workflow | Invoke researcher to examine checkout code, debugger if needed, then fix |
| "Clean up the user service" | Code improvement → Refactor workflow | Invoke researcher to analyze user service, then code-refactorer |
| "How should we implement caching?" | Planning question → Plan workflow | Invoke researcher + planner, present options, stop before implementation |
| "Fix the README" or "Document this feature" | Documentation request → Docs workflow | Invoke researcher to understand project, then documentation-writer following minimal README principles |

## Budget & Stop Conditions

- **Model choice**: Default to haiku for research/summarization and small scopes; escalate to sonnet only when complexity requires
- **Call limits**: If you reach 6 subagent calls in a workflow, pause and summarize; ask user before proceeding
- **New dependencies / migrations**: Stop and confirm with user before adding packages or changing schemas
- **Destructive commands**: Never run `rm`, schema drops, or credential-related commands without explicit user approval
- **Test/build failures**: After one failed test/build run, invoke `debugger` before retrying to avoid flailing
- **Context control**: For long runs, invoke `summarizer` after every 8 subagent calls or when state files exceed ~200 lines
- **Output contract compliance**: If a subagent response is missing required contract fields (see `.claude/skills/orchestration/agent-output-contract.md`), request a quick re-run with the contract reminder before proceeding

## Output Contract Validation

Before accepting subagent output, check replies for required fields (YAML frontmatter):
- `summary` (non-empty list)
- `artifacts` (can be empty)
- `decisions` (for roles that decide)
- `risks` (list, can be empty)
- `open_questions` (list, can be empty)
- Role-specific fields present (e.g., planner: `plan_steps`; reviewer: `must_fix/should_fix/tests_missing`; test-writer: `tests_added`; code-writer: `changes/testing`)

If any required field is missing, ask the subagent to re-run with:
> "Please reissue your response using the Agent Output Contract in `.claude/skills/orchestration/agent-output-contract.md` with all required fields populated."

## When to Ask for Clarification

Only ask the user for clarification if the request is genuinely ambiguous:
- Multiple completely different interpretations
- Missing critical information (e.g., "fix it" without saying what's broken)
- Conflicting requirements

**Default to action**: If 80% confident about intent, proceed. Don't over-ask.
