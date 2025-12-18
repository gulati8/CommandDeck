# CommandDeck 30/60/90 Implementation Tasks

Owner: _TBD_ | Last updated: 2024-12-18  <!-- replace during edits if desired -->

## Days 0–7: Correctness + Trustworthiness
- [x] Align public docs with reality (agent/command counts, tables, install script output).
- [x] Fix skills index mismatches (orchestration/state-management SKILL files vs actual directories).
- [x] Publish a single “Agent Output Contract” doc.
- [x] Migrate 2–3 key agents (`researcher`, `planner`, `code-writer`) to the contract.

## Days 7–30: Cost + Performance
- [ ] Trim prompts across the fleet; move checklists into skills and link to them.
- [x] Add budget gates/stop-conditions to `PICARD.md` (e.g., max subagent calls, new dependency guard, test failure escalation).
- [ ] Expand hooks logging: capture agent id, duration, outcome; extend beyond `Task` if feasible.
- [x] Update `costs:report` to surface agent/model invocation counts and wall-time/cost insights (plus add log-summary utility).
- [x] Trimmed heaviest prompts (frontend-architect, premium-ux-designer, performance-optimizer) into skills references.

## Days 30–60: Product Development Coverage
- [ ] Add focused agents: `product-manager`, `qa-lead`, `release-manager`, `analytics-engineer`, `ux-researcher` (or similar names).
- [ ] Add workflows: `/project:spec` (PRD/AC), `/project:release-plan`, `/project:qa-charter`.
- [ ] Integrate new workflows into `feature` flow (PRD/AC → plan → build → test → release).

## Days 60–90: Portability + Evaluation
- [ ] Create provider-neutral agent manifest (id, purpose, capabilities, model tier, output schema, prompt path).
- [ ] Build adapters for Claude Code (generate `.claude/agents/*.md` + hooks) and Codex CLI (role prompts/playbook).
- [ ] Add an eval pack (10–20 tasks) with scoring: schema compliance, diff correctness, test completeness, security, cost ceilings.
- [ ] Wire evals into CI or a repeatable script for regression testing prompt changes.
