# CommandDeck Agent Fleet Review (Claude Code–first, portable to Codex)

**Scope reviewed**: `BridgeCrew/.claude/` (installed into target projects as `.claude/` + root `CLAUDE.md`), plus supporting docs and install script.

This review focuses on quality, comprehensiveness, performance, cost, safety/controls, and “product development fitness”. It also calls out what to change to make this reusable across Claude Code, Codex CLI, and other agentic runtimes.

---

## Executive Summary

Your system is a solid “Claude Code orchestration kit”: it has clear separation between an orchestrator (PICARD → installed as `CLAUDE.md`) and specialized subagents, a set of repeatable workflows (`.claude/commands/*`), and light-weight persistence (`.claude/state/*`) plus instrumentation hooks (`.claude/logs/orchestration.jsonl`).

The biggest issues today are:

- **Token overhead and cost pressure** from very large agent prompts (persona + long checklists repeated in every agent file).
- **Documentation drift**: repo docs and install output describe “10 agents / 7 commands” while the current fleet is **20 agents / 10 commands**.
- **Weak machine-readability**: state/logs exist, but outputs are not standardized enough to reliably automate review loops, cost tracking, or cross-runtime portability.
- **Workflow completeness for product development**: strong on implementation/testing/security, weaker on upstream product discovery/specs/acceptance criteria and downstream release/operational readiness.

If you address prompt bloat + standardize contracts + add a minimal evaluation harness, this becomes a very reusable “agent team” that can run on Claude Code and translate cleanly to Codex-style tooling.

---

## What You Have Today (Architecture Snapshot)

### Core packaging model

- **Source of truth**: `BridgeCrew/.claude/`
- **Installation**: `scripts/install.sh` copies `BridgeCrew/.claude` into target project root as `.claude/` and renames `BridgeCrew/.claude/PICARD.md` → `CLAUDE.md`.
- **Orchestrator**: `BridgeCrew/.claude/PICARD.md`
- **Agents**: `BridgeCrew/.claude/agents/*.md` (currently **20** agents)
- **Workflows**: `BridgeCrew/.claude/commands/**/*.md` (currently **10** commands)
- **Skills library**: `BridgeCrew/.claude/skills/**` (domain docs + state utilities)
- **State persistence**: `.claude/state/*.md` with append-only step updates via bash scripts
- **Hook logging**: `BridgeCrew/.claude/settings.json` logs Task start/end to `.claude/logs/orchestration.jsonl`

### Agent fleet inventory (high level)

**Core dev**: `researcher`, `planner`, `code-writer`, `code-reviewer`, `test-writer`, `documentation-writer`, `debugger`, `summarizer`, `log-analyzer`, `feedback-coordinator`, `code-refactorer`, `git-commit-helper`

**Domain specialists**: `frontend-architect`, `premium-ux-designer`, `database-architect`, `api-designer`, `security-auditor`, `performance-optimizer`, `devops-engineer`, `product-strategy-advisor`

### Workflow command inventory (high level)

`feature`, `frontend-feature`, `bugfix`, `refactor`, `plan`, `review`, `design-system`, `security-audit`, `logs:summary`, `costs:report`

---

## Strengths (What’s Good)

### 1) Clear orchestrator/subagent separation (Claude Code–native)

- The orchestrator is explicitly instructed to **delegate, not implement**, which is the single biggest lever for predictable behavior in a multi-agent setup.
- The “isolated context” model reduces cross-task contamination and makes failures easier to debug.

### 2) Practical workflow scaffolding

- Your commands encode sensible “happy path” sequences: `research → plan → implement → review → test → docs`.
- You explicitly call out **parallelization** and “batch Task calls”, which is directionally right for wall-clock time (even if it can raise token spend; see gaps).

### 3) State persistence + resumability

- The bash utilities (`init-state.sh`, `update-step.sh`, `complete-state.sh`) are simple and robust.
- Append-only updates are a good default (low corruption risk, easy human audit).

### 4) Early instrumentation hooks

- The `PreToolUse/PostToolUse` hooks around `Task` are a great start: they provide the seed of observability for orchestration behavior.

### 5) Sensible model tiering (in principle)

- Using “haiku for read-only / summarization” and “sonnet for complex reasoning/coding” is the right direction for cost-performance.

### 6) Skills library is the right abstraction

- The presence of domain “skills” (`frontend/`, `security/`, `devops/`, `docker/`, `testing/`) is a strong mechanism to keep prompts stable while evolving best practices.

---

## Gaps / Risks (What’s Bad, Missing, Slow, or Overly Costly)

### A) Quality & consistency issues

1) **Documentation drift (confidence killer)**

- `README.md` and `scripts/install.sh` describe “10 agents / 7 commands”, while `BridgeCrew/.claude/agents/` contains **20** agents and `BridgeCrew/.claude/commands/` contains **10** commands.
- This drift matters: users will assume missing capabilities, or won’t discover newer ones.

2) **Skills reference mismatch**

- `BridgeCrew/.claude/skills/orchestration/SKILL.md` and `BridgeCrew/.claude/skills/state-management/SKILL.md` reference `templates/` directories that don’t exist in `BridgeCrew/.claude/skills/**`.
- This is a small issue but it signals “the system says it has X, but it doesn’t”, which hurts trust.

3) **Agent prompts are very large and duplicate content**

Example: `BridgeCrew/.claude/agents/code-writer.md` includes:

- Long persona sections
- Long standards checklists
- Output templates
- Domain-specific guidance (React/Tailwind) that overlaps with `.claude/skills/frontend/*`

This drives:

- Higher per-invocation prompt tokens
- Lower effective context for the actual task
- Higher variance (agents may over-focus on the template vs the task)

4) **Output contracts are not strict**

The agents frequently use “markdown free-form” outputs. That’s readable, but:

- Hard to automatically feed outputs into the next agent
- Hard to detect whether required fields were delivered
- Hard to score or regress-test agent behavior

### B) Performance gaps (wall-clock and cognitive)

1) **Parallelization guidance can backfire**

In Claude Code, “multiple Task calls in one message” can reduce time-to-first-result, but:

- It **doesn’t reduce total tokens** (often increases tokens by duplication of context)
- It increases merge/coordination overhead for the orchestrator
- It can degrade quality if each parallel agent lacks shared context or a consistent spec

2) **No explicit “stop conditions”**

There’s no strong policy like:

- “If research finds <2 relevant files, stop and ask”
- “If plan includes >N files or new deps, stop and confirm”
- “If tests fail twice, escalate to debugger”

You have delegation levels guidance, but not enough runtime “guardrails” to prevent spinning.

3) **Hooks log Task start/end only**

This misses:

- Duration
- Failure categories
- Subagent identity (current method infers from `TOOL_ARGS_prompt` substring matching; brittle)
- Bash command runs and their outcomes (a major performance and safety signal)

### C) Cost issues

1) **Prompt bloat creates “fixed tax” per subagent call**

Claude subagents typically pay a non-trivial base cost. Making agent prompt files long worsens this tax. With 4–8 subagent calls per workflow, you’re amplifying overhead.

2) **Many agents default to Sonnet**

Sonnet is a good default for coding, but several roles could be Haiku-first with escalation:

- `planner` for smaller tasks
- `code-reviewer` for smaller diffs
- `product-strategy-advisor` for lightweight decisions
- `api-designer` for “standard REST endpoint” tasks

3) **No enforced budgets**

You have a `costs:report` command, but no “budget contract” enforced by the orchestrator (e.g., “keep < $X” or “max N subagent calls before summarization”).

### D) Safety / control-plane gaps

1) **Permissions posture is permissive**

`BridgeCrew/.claude/settings.json` includes:

- `defaultMode: "acceptEdits"`
- allowlist includes `Write(*)`, `Edit(*)`, `Bash`, `WebSearch`, `Task(*)`

In practice, agent tool permissions are largely controlled by each agent’s frontmatter, but the “accept edits by default” posture increases the chance of unintended modifications.

2) **Bash/WebSearch guardrails are weak**

There’s limited explicit policy like:

- No destructive commands without confirmation
- No credential access
- No scanning large directories
- WebSearch only when explicitly required

These belong in the orchestrator and/or a shared “safety policy skill”.

### E) Product development completeness gaps

You’re strong for “engineering execution” but weaker for “product development end-to-end”.

Missing (or not first-class) capabilities:

- **PRD / requirements**: turning a fuzzy user request into acceptance criteria, edge cases, non-functional requirements.
- **UX research / JTBD**: you have premium UI design, but not “user goals → flows → usability risks”.
- **Backlog and scope control**: explicit “cut scope / ship v1 / v2” framing.
- **Release management**: changelog, versioning, rollout plan, feature flags, migration steps.
- **Operational readiness**: runbooks, alerting, SLOs, incident playbooks (some mentioned in code-writer, but not enforced).
- **Analytics**: event taxonomy, instrumentation plan, experiment design.

You do have `product-strategy-advisor`, which is useful, but “strategy” is not a substitute for “execution-grade PRD + acceptance tests”.

### F) Reuse across Codex / other runtimes

This fleet is currently **Claude Code–shaped**:

- Tool names (`Read`, `Write`, `Edit`, `Task`) are Claude Code–specific.
- “Subagents” are Claude Code–native; Codex CLI doesn’t spawn subagents the same way.
- Frontmatter schema is Claude Code agent-definition style.

Portability isn’t impossible, but it needs an intermediate abstraction layer (manifest + adapters).

---

## High-Impact Improvements (Prioritized)

### 1) Shrink prompts, move standards into skills

Goal: reduce “fixed tax” per Task call.

Actions:

- Reduce each agent file to:
  - 5–10 lines of role definition
  - 5–10 lines of rules/constraints
  - A strict output schema
  - A short pointer to relevant skills docs (by path)
- Move large checklists (React standards, security checklists, etc.) into `.claude/skills/**` and reference them.
- Make “persona flavor” optional (1–2 lines) or removable via a config flag.

Expected impact:

- Lower token cost per invocation
- More consistent behavior
- Easier portability (Codex-style systems prefer shorter, contract-driven prompts)

### 2) Standardize a strict agent output contract

Goal: predictable handoffs and better automation.

Recommended default: **YAML frontmatter + markdown body** OR pure JSON.

Minimum fields (strongly recommended):

- `summary` (1–3 bullets)
- `artifacts` (files/paths, commands run, PRD sections, etc.)
- `decisions` (with rationale)
- `risks` (severity + mitigation)
- `open_questions` (blocking vs non-blocking)
- `confidence` (low/med/high)

Also add role-specific fields:

- `planner`: `plan_steps`, `parallel_groups`, `test_plan`, `rollback_plan`
- `code-reviewer`: `must_fix`, `should_fix`, `nitpicks`, `test_gaps`
- `test-writer`: `tests_added`, `coverage_notes`, `how_to_run`

### 3) Add routing + stop-condition policies in the orchestrator

Goal: fewer wasted invocations, better safety.

Add explicit orchestrator rules:

- **Budget gates**:
  - Max subagent calls per workflow unless user approves
  - Prefer Haiku-first for research/triage
- **Stop conditions**:
  - If no pattern found, consult user (don’t invent architecture)
  - If new dependency needed, stop and ask
  - If destructive bash command suggested, stop and ask
- **Escalation**:
  - Use `debugger` after first failure of tests/build, not after repeated flailing

### 4) Improve observability: logs → metrics → cost control

Goal: make cost/perf visible and actionable.

Actions:

- Log structured data per tool call:
  - agent name
  - workflow/command
  - start/end timestamps + duration
  - success/failure + error class
- Extend hooks beyond `Task`:
  - Capture `Bash` tool calls (careful about secrets)
  - Capture `Write/Edit` counts (files touched)
- Update `costs:report` to compute:
  - invocations by agent/model
  - wall time distribution
  - “token tax per agent call” (approx if exact tokens unavailable)

### 5) Fill product-development gaps with 3–5 focused agents (not 20 more)

Goal: cover discovery → ship → operate.

Recommended additions (minimal, high leverage):

- `product-manager` (PRD + acceptance criteria + scope cutting)
- `ux-researcher` (flows, usability risks, JTBD, content design)
- `release-manager` (rollout plan, feature flags, changelog, migration steps)
- `qa-lead` (test strategy, exploratory test charters, risk-based coverage)
- `analytics-engineer` (event taxonomy, instrumentation, experiments)

You can keep `product-strategy-advisor` for “build/kill decisions”, but it should be downstream of a PRD/AC pipeline.

### 6) Add a portability layer (Claude ↔ Codex)

Goal: reuse the same “team design” across runtimes.

Approach:

1) Create an **agent manifest** (provider-neutral) describing:
   - agent id/name
   - purpose
   - capabilities (read/search/edit/run)
   - default model tier (fast/standard/deep)
   - output schema
   - prompt body path

2) Create provider adapters:

- **Claude Code adapter**:
  - generates `.claude/agents/*.md` frontmatter
  - maps capabilities → `tools:` list
  - installs commands/hooks

- **Codex CLI adapter**:
  - generates “role prompt snippets” and a single orchestrator playbook that says:
    - “When acting as `planner`, follow contract X”
  - optionally generates `./codex/` config docs (if you standardize them)

This keeps “agent identity” stable while translating tool syntax.

---

## Suggested 30/60/90 Day Plan

### Days 0–7: Correctness + trustworthiness

- Align docs with reality (agents/commands count, tables, install output).
- Fix skills index mismatches (either add missing `templates/` dirs or update SKILL docs).
- Add a single “Agent Output Contract” doc and update 2–3 key agents to use it (`researcher`, `planner`, `code-writer`).

**Success criteria**:
- New users can discover the full fleet from docs without confusion.
- First multi-agent workflow produces consistent, parseable outputs.

### Days 7–30: Cost + performance

- Shrink prompts across the fleet; move checklists to skills.
- Introduce budget gates and stop conditions in `PICARD.md`.
- Expand hook logging to include agent identity + duration.

**Success criteria**:
- ≥25–40% reduction in prompt tokens per Task call (measured via approximations or provider telemetry).
- Fewer “wasted” subagent calls per workflow (subjectively, and via logs).

### Days 30–60: Product development coverage

- Add `product-manager`, `qa-lead`, `release-manager` agents.
- Add workflows: `/project:spec` (PRD/AC), `/project:release-plan`, `/project:qa-charter`.
- Tie them into `feature` flow: PRD/AC → plan → build → test → release.

**Success criteria**:
- A feature request can be taken from idea → shipped PR with acceptance criteria and rollout plan, without inventing requirements mid-stream.

### Days 60–90: Portability + evaluation harness

- Implement provider-neutral manifest + generator for Claude Code + Codex CLI.
- Add an “eval pack” of 10–20 standardized tasks and scoring rubrics:
  - output schema compliance
  - diff correctness (for code tasks)
  - test completeness
  - security checks
  - cost ceilings

**Success criteria**:
- You can run the same “agent team” on Claude Code and a Codex-style environment with minimal changes.
- Prompt changes can be regression-tested.

---

## Concrete Suggestions (Claude Code–Specific)

1) **Change `defaultMode` away from auto-accept edits** for safer defaults, then explicitly allow autonomy in workflows where appropriate.
2) **Make agent identity explicit in logs** (don’t infer from substring match on `TOOL_ARGS_prompt`).
3) **Add a “preflight” command**:
   - Detect project language (node/python/go/rust)
   - Identify test commands
   - Cache findings in state
4) **Make summarization automatic**:
   - After N subagent calls or state size > X, invoke `summarizer` and replace the context passed forward with the compressed summary.

---

## Concrete Suggestions (Portability to Codex CLI and others)

Codex CLI doesn’t naturally spawn subagents like Claude Code; treat your “agents” as **roles** and your “commands” as **playbooks**.

Recommended portability pattern:

- Keep one orchestrator (Codex) but let it “switch modes” using the same output contracts:
  - “Now acting as `planner`…”
  - “Now acting as `code-reviewer`…”
- Use the manifest to maintain the same names, responsibilities, and contracts.
- Map tools:
  - Claude `Read/Grep/Glob` → Codex `rg/find/cat`
  - Claude `Write/Edit` → Codex `apply_patch`
  - Claude `Bash` → Codex `shell_command`

The key is: **contracts over personalities**. Personas can stay as optional flavor, but outputs should be normalized.

---

## Bottom Line

You have a strong base: the orchestration patterns, state persistence, and agent specialization are directionally correct for real product engineering. The system will improve materially if you (1) reduce per-agent prompt bloat, (2) standardize output contracts, (3) add budget/stop-condition policies, and (4) introduce a portability manifest so this “team” is not locked to Claude Code.

