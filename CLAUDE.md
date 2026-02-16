# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- **Install:** `npm install`
- **Run all tests:** `npm test`
- **Run a single test:** `node --test test/state.test.js`
- **Run CLI locally:** `npm run cli -- <command>` (e.g., `npm run cli -- status`, `npm run cli -- run my-repo "task"`)
- **Start Slack bot:** `npm start` (requires `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN`, `SLACK_SIGNING_SECRET`)

No build step — pure JavaScript, no transpilation.

## Code Style

- CommonJS (`require`/`module.exports`), strict mode (`'use strict';`) in every file
- 2-space indentation, single quotes, semicolons
- Lowercase domain-based filenames in `lib/` (e.g., `worktree.js`, `observability.js`)
- Node >= 20 required; tests use `node:test` + `node:assert/strict`
- Use `execFileSync` over `execSync` to avoid shell injection

## Architecture

CommandDeck is a multi-agent orchestration system that decomposes development tasks into parallel objectives executed by specialized Claude Code workers.

### Mission Lifecycle

1. **Entry:** User triggers via CLI (`cli.js`) or Slack bot (`q.js`) → creates a `Mission` instance (`lib/mission.js`)
2. **Planning:** Captain Picard agent decomposes the task into phased objectives stored in `mission.json`
3. **Execution:** Work loop launches up to `max_workers` (default 3) Claude Code workers in parallel, each in an isolated git worktree on its own branch (`commanddeck/<mission-id>/<obj-id>`)
4. **Integration:** Completed branches merge into an integration branch; O'Brien agent resolves conflicts
5. **Review:** Risk-flagged objectives trigger mandatory specialist reviews (Worf for security, Geordi for infra, Spock for dependencies)
6. **PR:** `lib/pr.js` creates a PR via `gh pr create` with evidence body

### Key Modules

| Module | Responsibility |
|---|---|
| `lib/mission.js` | Full mission lifecycle: decompose → workLoop → executeBatch → merge → review → PR |
| `lib/state.js` | File-based state with atomic mkdir locking, mission CRUD, version tracking |
| `lib/worker.js` | Spawns `claude -p` subprocesses per agent with allowed-tool restrictions and timeouts |
| `lib/worktree.js` | Git worktree create/remove/list for worker isolation |
| `lib/risk.js` | Risk flag detection (file patterns + keywords) → mandatory reviewer mapping |
| `lib/evidence.js` | Evidence bundle validation and PR body generation |
| `lib/health.js` | Health patrol detecting stuck workers, test failure loops, edit thrashing |
| `lib/learn.js` | Learning/governance: propose → approve/reject with scope detection |
| `lib/slack.js` | Slack reporters, channel mapping, proposal tracking with disk-backed persistence |

### State Management

All state lives under `~/.commanddeck/` (override with `COMMANDDECK_STATE_DIR`). Structure:
```
~/.commanddeck/projects/<repo>/missions/<id>/mission.json
```

Critical patterns:
- **Atomic locking:** All state mutations use `withMissionLock()` (mkdir-based lock)
- **Atomic writes:** tmp file + rename pattern
- **Version tracking:** Monotonic version counter on mission state

### Layered Context System

Loaded by `hooks/session-start.sh` in priority order:
1. Global standards (`~/.commanddeck/standards/*.md`)
2. Crew preferences (`~/.commanddeck/crew/<agent>-preferences.md`)
3. Project directives (`~/.commanddeck/projects/<repo>/directives/*.md`)
4. Repo ADRs (`docs/adr/*.md`)
5. Active mission state (mission.json, captains-log, briefings)

### Agent Model Tiers

- **Opus:** captain-picard, scotty (planning and architecture)
- **Sonnet:** borg, worf, spock, geordi, mr-data, obrien, guinan (implementation, review, operations)
- Configurable per project via `config.json` model_overrides

### Inter-Agent Communication

- **Briefings:** Downstream agents read upstream agent briefings from the mission state directory
- **Evidence bundles:** Contract between workers and the PR system — workers must always produce them

### Safety Guards

- `hooks/pre-write-guard.sh` blocks writes to `.env`, `.pem`, `.key`, secrets, credentials
- `hooks/pre-bash-guard.sh` blocks dangerous commands (rm -rf /, dd, mkfs, fork bombs)
- `hooks/pre-compact.sh` auto-commits and checkpoints before context compaction
- `lib/validate.js` validates git refs and repo names against injection
- Safety limits: max 50 sessions, max 6 hours, max 3 parallel workers, 45-min worker timeout

## Testing

- Place tests in `test/` with `*.test.js` suffix
- Tests use temp directories (`os.tmpdir()`) via `COMMANDDECK_STATE_DIR` for isolation
- No mocking library — tests use real file I/O with temp dirs and stub reporters
- Mirror module behavior: `describe` by module, `it` by scenario
