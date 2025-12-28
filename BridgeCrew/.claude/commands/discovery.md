---
description: Product discovery to requirements, UX, architecture, and GitHub Issues
argument-hint: <product idea>
---

# Product Discovery Workflow

Product idea: **$ARGUMENTS**

Turn the idea into requirements, annotated wireframes, a technical architecture proposal, and GitHub Issues on a kanban board.

## Command Authority

Based on initial assessment, determine delegation level:
- If this matches an established pattern → Proceed autonomously (Level 1-2)
- If approach options exist → Consult user (Level 3)
- If this is architecturally significant → Agree with user (Level 4)

See ORCHESTRATOR.md "7 Levels of Delegation" for guidance.

## Workflow Phases

Execute these phases in order, updating the state file after each:
**Common rules**: Follow `common-orchestration-rules.md`.

### Phase 1: Initialize State
1. Run: `.claude/skills/state-management/utilities/init-state.sh "$ARGUMENTS" "$ARGUMENTS"`
2. Capture the state file path from output (e.g., `.claude/state/YYYY-MM-DD_discovery-name.md`)
3. Store this path in a variable for subsequent updates

### Phase 2: Requirements Discovery
1. Update state: `.claude/skills/state-management/utilities/update-step.sh "$STATE_FILE" "requirements" "in_progress" "Starting requirements discovery"`
2. Use the `product-manager` subagent to:
   - Ask clarifying questions
   - Produce testable requirements using `.claude/skills/orchestration/templates/requirements-doc.md`
   - Capture scope boundaries and assumptions
3. Update state: `.claude/skills/state-management/utilities/update-step.sh "$STATE_FILE" "requirements" "complete" "Requirements drafted"`

### Phase 3: UX Iteration
1. Update state: `.claude/skills/state-management/utilities/update-step.sh "$STATE_FILE" "ux" "in_progress"`
2. Use `frontend-architect` and `premium-ux-designer` to:
   - Translate requirements into UX flows
   - Produce annotated wireframes using `.claude/skills/orchestration/templates/annotated-wireframes.md`
3. If conflicting recommendations arise, resolve with a single follow-up pass.
4. Update state: `.claude/skills/state-management/utilities/update-step.sh "$STATE_FILE" "ux" "complete" "Wireframes produced"`

### Phase 4: Architecture Proposal
1. Update state: `.claude/skills/state-management/utilities/update-step.sh "$STATE_FILE" "architecture" "in_progress"`
2. Use the `planner` and `api-designer` subagents to:
   - Produce a technical architecture proposal using `.claude/skills/orchestration/templates/architecture-proposal.md`
   - Define API surface, data flows, and risks
3. Update state: `.claude/skills/state-management/utilities/update-step.sh "$STATE_FILE" "architecture" "complete" "Architecture proposal drafted"`

### Phase 5: Work Breakdown
1. Update state: `.claude/skills/state-management/utilities/update-step.sh "$STATE_FILE" "tickets" "in_progress"`
2. Use `code-writer` and `test-writer` to:
   - Break work into tickets using `.claude/skills/orchestration/templates/ticket-breakdown.md`
   - Include acceptance criteria and test plan notes
3. Update state: `.claude/skills/state-management/utilities/update-step.sh "$STATE_FILE" "tickets" "complete" "Tickets drafted"`

### Phase 6: GitHub Issues + Kanban
1. Update state: `.claude/skills/state-management/utilities/update-step.sh "$STATE_FILE" "github" "in_progress"`
2. Use `gh` to create issues and a Project board:
   - Confirm `gh auth status`
   - Determine repo and owner (use `gh repo view --json nameWithOwner`)
   - Create or reuse a Project board titled from the product idea
   - Create issues for each ticket and apply labels
   - Add issues to the Project board columns (Backlog, Ready, In Progress, In Review, Done)
3. If `gh` is unavailable or unauthenticated, provide manual commands and export a CSV/JSON file.
4. Update state: `.claude/skills/state-management/utilities/update-step.sh "$STATE_FILE" "github" "complete" "Issues and board updated"`

### Phase 7: Complete
1. Run: `.claude/skills/state-management/utilities/complete-state.sh "$STATE_FILE" "Discovery complete: requirements, wireframes, architecture, and tickets delivered"`
2. Provide final summary to user

## Begin

Start with Phase 1 for product discovery: **$ARGUMENTS**
