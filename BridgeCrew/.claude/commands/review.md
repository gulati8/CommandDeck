---
description: Code review workflow - review recent changes or specified files
argument-hint: <files to review or 'recent' for git changes>
---

# Code Review Workflow

You are performing a code review for: **$ARGUMENTS**

## Determine Scope

If argument is "recent" or similar:
- Run `git diff` to see uncommitted changes
- Run `git log -1 --name-only` to see last commit's files

Otherwise, review the specified files.

## Review Process

Use the `code-reviewer` subagent to analyze:
- Code correctness
- Security vulnerabilities
- Performance issues
- Style and patterns
- Test coverage

## Output

Provide a structured review report with:
- Overall assessment
- Critical issues (must fix)
- Warnings (should fix)
- Suggestions (nice to have)
- What's done well

## Begin

Start review for: **$ARGUMENTS**
