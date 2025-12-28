# Codex Orchestrator System

This file is the Codex-compatible orchestration guide for CommandDeck. Codex does not support Claude subagents or slash commands, so use a single-agent, phase-based workflow.

## Operating Principles

- Keep scope small and explicit.
- Prefer existing patterns and minimal changes.
- Track progress in state files.
- Ask for clarification when requirements or risks are unclear.

## State Management

CommandDeck ships state utilities at:
- .claude/skills/state-management/utilities/

Use these from the target project:
- init-state.sh
- update-step.sh
- complete-state.sh
- add-metrics.sh
- get-state.sh

## Workflow Entry Points (Codex)

Use the helper scripts to initialize a workflow and create a state file:

- .codex/scripts/codex-feature.sh "<request>"
- .codex/scripts/codex-bugfix.sh "<request>"
- .codex/scripts/codex-refactor.sh "<request>"
- .codex/scripts/codex-plan.sh "<request>"
- .codex/scripts/codex-review.sh "<target>"
- .codex/scripts/codex-quickfix.sh "<request>"
- .codex/scripts/codex-lite-feature.sh "<request>"
- .codex/scripts/codex-lite-bugfix.sh "<request>"
- .codex/scripts/codex-discovery.sh "<request>"
- .codex/scripts/codex-spec.sh "<request>"

## Workflow Playbooks

### Feature
1. Research: find relevant files, patterns, and risks.
2. Plan: propose approach, files, and validation steps.
3. Implement: make changes with tests where appropriate.
4. Verify: run tests or provide manual verification steps.
5. Review: self-review for correctness, security, and regressions.

### Bugfix
1. Triage: reproduce and identify scope.
2. Diagnose: root cause and minimal fix.
3. Implement: fix with guardrails.
4. Verify: add or run tests, or provide manual steps.
5. Review: check for regressions.

### Refactor
1. Analyze: identify debt and refactor boundaries.
2. Plan: ensure test coverage and safe rollout.
3. Refactor: small, reversible edits.
4. Verify: tests and behavior check.
5. Review: check for functional equivalence.

### Plan
1. Research: gather context.
2. Options: list 2-3 approaches with trade-offs.
3. Recommendation: choose one and outline steps.

### Review
1. Scope: define target files or diff.
2. Findings: list issues by severity.
3. Actions: concrete fixes or follow-ups.

### Quickfix
1. Identify: single-file, low-risk change.
2. Implement: small edit.
3. Verify: quick sanity check.

### Lite Feature/Bugfix
Follow Feature/Bugfix with minimal planning and testing.

### Discovery
1. Requirements: problem, goals, users, scope.
2. UX: flows and constraints.
3. Architecture: components, risks, milestones.

### Spec
1. Product vision and goals.
2. UX flow.
3. Technical spec and QA plan.

## Notes for Codex

- Do not rely on Claude subagents or slash commands.
- Use the state utilities to keep work resumable.
- Keep responses concise and action-oriented.
