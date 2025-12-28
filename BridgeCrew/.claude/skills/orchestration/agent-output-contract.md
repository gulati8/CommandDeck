# Agent Output Contract (Provider-Neutral)

Use this contract to normalize all subagent responses so they can be chained, parsed, and evaluated automatically. Keep outputs concise; prefer YAML frontmatter + markdown body, or pure JSON when structured data is required.

## Core Fields (all agents, required)

- `summary` (3 bullets max)
- `artifacts` (files, commands run, links to state/logs; empty if none)
- `decisions` (key decisions with rationale)
- `risks` (list with severity + mitigation; empty if none)
- `open_questions` (blocking vs non-blocking; empty if none)
- `confidence` (low | medium | high)

### YAML Frontmatter Shape
```yaml
summary:
  - ...
artifacts:
  - path: path/to/file
    action: created|modified|read|ran_command
    notes: optional
decisions:
  - what: choice made
    why: rationale
risks:
  - severity: high|medium|low
    item: description
    mitigation: optional
open_questions:
  - blocking: true|false
    item: question text
confidence: medium
```

## Role-Specific Fields (required unless marked optional)

- **planner**: `plan_steps` (ordered list), `parallel_groups` (list of step ids, use [] if none), `test_plan`, `rollback_plan`
- **code-writer**: `changes` (file→summary), `testing` (how to run, even if not_run), `followups`
- **code-reviewer**: `must_fix`, `should_fix`, `nits`, `tests_missing`
- **test-writer**: `tests_added` (file + intent), `coverage_notes`, `how_to_run`
- **researcher**: `findings` (path/snippet/purpose), `gaps`
- **security-auditor**: `findings` (severity/evidence/recommendation), `attack_surface`, `secrets`, `tests` (optional if none)
- **privacy-auditor**: `findings`, `data_map`, `retention`, `consent`, `third_parties`, `mitigations`
- **devops-engineer**: `pipeline_steps`, `env_vars`, `rollout`, `backout`
- **release-manager**: `rollout_plan`, `rollback_plan`, `verification`, `dependencies`, `risk_controls`
- **frontend-architect**: `component_plan` (name/responsibility/props/state/patterns), `state_strategy`, `routing`, `styling`
- **premium-ux-designer**: `layouts`, `components`, `states` (loading/empty/error/success), `motion`, `a11y`, `content_notes`
- **product-manager**: `problem`, `target_users`, `user_stories`, `acceptance_criteria`, `non_functional_requirements`, `success_metrics`, `out_of_scope`, `assumptions`
- **product-spec-writer**: `file_map`, `docs_created`, `assumptions`
- **performance-optimizer**: `findings`, `hotspots`, `recommendations`, `validation`
- **database-architect**: `schema_changes`, `migrations`, `indexes`, `queries`, `rollback_plan`
- **api-designer**: `endpoints` (method/path/purpose/authz/payload/response/errors), `versioning`, `validation`, `testing`
- **debugger**: `findings`, `root_cause`, `fix`, `verification`, `fallbacks` (if partial)
- **documentation-writer**: `audience`, `sections`, `examples`, `changes_made`
- **log-analyzer**: `activity_overview`, `agent_usage`, `failures`, `recommendations`
- **feedback-coordinator**: `iterations`, `status` (CONVERGED|MAX_ITERATIONS|ESCALATED), `next_actions`
- **summarizer**: `compression`, `key_decisions`, `completed`, `current_state`, `next_actions`

## Output Rules

1) Always populate all core fields (use empty lists when nothing to report).
2) Keep bullets terse; no prose paragraphs in `summary/decisions/risks`.
3) When providing code diffs, link paths in `artifacts` and keep the body focused on reasoning, not full code dumps.
4) If a field is intentionally omitted, state why (e.g., `rollback_plan: not_applicable`).
5) Validate outputs before using them:
   - Save agent output to a temp file (e.g., `/tmp/agent-output.md`)
   - Run `.claude/skills/orchestration/utilities/validate-agent-output.sh /tmp/agent-output.md <role>`
   - If validation fails, request a re-emit using this contract.

## Usage

- Link to this contract from each agent prompt and enforce the schema in “Expected Output”.
- Prefer YAML frontmatter for readability; fall back to JSON if the downstream consumer expects strict JSON.
- Downstream agents should validate presence of required fields before acting. If missing, request a re-run with this contract.
