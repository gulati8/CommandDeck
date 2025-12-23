# Feedback Loop Template

Use this template when delegating to `feedback-coordinator`.

```markdown
## Task
Run a feedback loop to resolve: {issues summary}

## Agents
- Agent A: {e.g., code-reviewer}
- Agent B: {e.g., code-writer}
- Max iterations: {N}

## Inputs
- Findings: {bullets}
- Current artifacts: {paths/links}
- Success criteria: {clear pass condition}

## Constraints
- Keep changes minimal and within scope
- No new deps or architecture changes without approval

## Expected Output (per Agent Output Contract)
- `iterations` (issue → resolution)
- `status` (CONVERGED | MAX_ITERATIONS | ESCALATED)
- `next_actions`
```
