---
title: Summarization Task Template
purpose: High-fidelity compression that preserves critical technical context.
model: haiku
tools: Read
---

# Summarization Task

You are summarizing long orchestration context (state/logs/notes) for future subagents.
Your summary must be compact but must NOT drop critical technical knowledge.

## Inputs
- Source: {state file path(s), logs, or notes}
- Compression target: {e.g., 70-85% reduction or max 120 lines}
- Audience: subagents who need to continue the work without re-reading the full context

## Non-Negotiables (do not drop if present)
- Architectural decisions and their rationale
- Invariants, constraints, and "must not break" behavior
- File paths and key modules touched or referenced
- Data models, schemas, and API contracts (names + shape)
- Error messages, root causes, and known failure modes
- Open questions, blockers, and unresolved risks
- Testing status and any failing tests
- Environment/config assumptions (env vars, versions, flags)

## Output Rules
- Prioritize high-signal technical details; omit fluff and narrative.
- Preserve exact identifiers (file names, functions, endpoints, config keys).
- If details are unclear, note the gap rather than guessing.
- If compression target cannot be met without losing critical context, say so.

## Output Format
Follow `.claude/skills/orchestration/agent-output-contract.md` using YAML frontmatter.
Include the summarizer-specific fields:
- `compression` (lines→lines)
- `key_decisions`
- `completed`
- `current_state`
- `next_actions`

## Suggested Sections (body)
- **Context Index**: key files/modules + purpose (max 6)
- **Critical Facts**: constraints, invariants, requirements (bullets)
- **Interfaces & Data**: APIs, schemas, types (bullets)
- **Progress**: done/doing/next (bullets)
- **Risks & Open Questions**: unresolved items (bullets)

## Example Prompt (filled by orchestrator)
```
Summarize the following state file and recent notes for continuation.
Compression target: max 120 lines or 80% reduction.
Source:
- .claude/state/YYYY-MM-DD_add-auth.md
Recent notes:
- Failing tests: auth.spec.ts (refresh token mismatch)
```
