# Agent Output Contract (Provider-Neutral)

Use this contract to normalize all subagent responses so they can be chained, parsed, and evaluated automatically. Keep outputs concise; prefer YAML frontmatter + markdown body, or pure JSON when structured data is required.

## Core Fields (all agents)

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

## Role-Specific Fields

- **planner**: `plan_steps` (ordered list), `parallel_groups` (list of step ids), `test_plan`, `rollback_plan`
- **code-writer**: `changes` (file→summary), `testing` (how to run), `followups` (tech debt)
- **code-reviewer**: `must_fix`, `should_fix`, `nits`, `tests_missing`
- **test-writer**: `tests_added` (list with file + intent), `coverage_notes`, `how_to_run`
- **researcher**: `findings` (list with path/snippet/purpose), `gaps` (what’s missing)
- **security-auditor**: `findings` (severity, evidence, recommendation), `attack_surface`, `secrets`
- **devops-engineer**: `pipeline_steps`, `env_vars`, `rollout`, `backout`

## Output Rules

1) Always populate all core fields (use empty lists when nothing to report).
2) Keep bullets terse; no prose paragraphs in `summary/decisions/risks`.
3) When providing code diffs, link paths in `artifacts` and keep the body focused on reasoning, not full code dumps.
4) If a field is intentionally omitted, state why (e.g., `rollback_plan: not_applicable`).

## Usage

- Link to this contract from each agent prompt and enforce the schema in “Expected Output”.
- Prefer YAML frontmatter for readability; fall back to JSON if the downstream consumer expects strict JSON.
- Downstream agents should validate presence of required fields before acting. If missing, request a re-run with this contract.
