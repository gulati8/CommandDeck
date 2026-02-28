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

## Vision

CommandDeck is a self-hosted agentic software development platform. The long-term goal is for any developer to clone this repo, run a setup script, and have a fully deployed end-to-end workflow: Slack message → agentic development → automated testing → staged deployment → team approval → production.

Think of it as a private, customizable software development firm powered by AI agents.

### Design Principles

- **Self-hosted first, SaaS later.** Build for single-tenant self-hosted deployment. Architect decisions with awareness that this may become multi-tenant SaaS, but don't build for it yet.
- **Slack is the access control layer.** No user management in CommandDeck. Private Slack channels control who can see and interact with each project. A `#command-deck` meta-channel handles project creation; per-project channels (e.g., `#weather-aggregator`) handle development work.
- **Idempotent setup.** The setup script must detect existing configuration and hook into it rather than overwriting. Running setup twice should be safe.
- **Externalize, don't hardcode.** Domains, cloud providers, deployment targets, and infrastructure details must be configurable — not baked into code.
- **Incremental value.** Every change should be usable immediately, not gated behind a larger feature. Ship working increments.

### Environment Model

- **Dev preview** — Ephemeral per-PR environments. Auto-created on PR, auto-destroyed on merge/close. Each gets its own subdomain.
- **Staging** — Persistent environment where `main` branch deploys. All projects live at configurable subdomains (currently `*.gulatilabs.me`).
- **Production** — Separate infrastructure per project. Planned but not yet implemented. Will eventually support dedicated EC2 instances or EKS depending on load.
- **Testing** — Automated CI via GitHub Actions. Runs on every PR and push to main.

### Customization Model

CommandDeck ships with a default crew and sensible defaults. Users customize via the layered context system (see below). Priority order for customization work:

1. **Tune existing crew** — Crew preference files modify agent behavior per-project or globally (e.g., "always use bun", "check for HIPAA compliance")
2. **New agent roles** — Register custom specialists beyond the default crew (e.g., Designer, DBA)
3. **Workflow templates** — Project-type-specific decomposition patterns (e.g., React apps vs. Go services)

### Roadmap (Priority Order)

1. Build the setup/installation script
2. Abstract the infrastructure/deployment layer for portability

## Architecture

CommandDeck is a multi-agent orchestration system that decomposes development tasks into parallel objectives executed by specialized Claude Code workers.

### Mission Lifecycle

1. **Entry:** User triggers via CLI (`cli.js`) or Slack bot (`q.js`) → creates a `Mission` instance (`lib/mission.js`)
2. **Planning:** Captain Picard agent decomposes the task into phased objectives stored in `mission.json`
3. **Execution:** Work loop launches up to `max_workers` (default 1, configurable via `COMMANDDECK_MAX_WORKERS`) Claude Code workers in parallel, each in an isolated git worktree on its own branch (`commanddeck/<mission-id>/<obj-id>`)
4. **Integration:** Completed branches merge into an integration branch; O'Brien agent resolves conflicts when they occur
5. **Review:** Risk-flagged objectives trigger mandatory specialist reviews (Worf for security, Geordi for infra, Spock for dependencies). Risk flags come from Picard's initial assignment and post-execution evidence-based file analysis — not speculative keyword matching.
6. **PR:** `lib/pr.js` creates a PR via `gh pr create` with evidence body and Slack thread metadata
7. **Deploy:** GitHub Actions builds images, deploys PR preview environment, notifies Slack thread with UAT URL
8. **Approval:** User reacts in Slack thread — checkmark merges PR and cleans up, X closes PR and cleans up

### Key Modules

| Module | Responsibility |
|---|---|
| `lib/mission.js` | Full mission lifecycle: decompose → workLoop → executeBatch → merge → review → PR |
| `lib/state.js` | File-based state with atomic mkdir locking, mission CRUD, version tracking |
| `lib/worker.js` | Spawns `claude -p` subprocesses per agent; `loadAgentIdentity()` reads `agents/*.md` frontmatter for identity, tools, model |
| `lib/worktree.js` | Git worktree create/remove/list for worker isolation |
| `lib/risk.js` | Risk flag detection (file patterns on actual changes) → mandatory reviewer mapping |
| `lib/evidence.js` | Evidence bundle validation and PR body generation (includes Slack metadata) |
| `lib/pr.js` | PR creation, update, merge, close, and branch cleanup (temp-file based for container compat) |
| `lib/health.js` | Health patrol detecting stuck workers, test failure loops, edit thrashing |
| `lib/learn.js` | Learning/governance: propose → approve/reject with scope detection |
| `lib/slack.js` | Slack reporters, channel mapping, proposal tracking, PR approval tracking |
| `lib/scaffold.js` | Project scaffolding: init structure, CI/CD, Docker templates, channel mapping |
| `lib/thread.js` | Slack thread-based conversational iteration and mission follow-ups |
| `lib/auth.js` | Claude CLI auth verification and OAuth failure detection |
| `lib/deploy.js` | Caddy reverse proxy integration for app deployments |
| `lib/http-health.js` | HTTP GET /health endpoint for container monitoring |
| `lib/observability.js` | Structured event logging and health alert persistence |
| `lib/validate.js` | Git ref and repo name validation against injection |
| `q.js` | Slack bot entry point: command routing, approval reactions, health patrol |
| `cli.js` | CLI entry point for local/non-Slack usage |
| `entrypoint.sh` | Container startup: SSH known_hosts, gh auth from GH_TOKEN, git config |
| `agents/*.md` | Agent identity files with YAML frontmatter (tools, model) and markdown identity text |
| `defaults/` | Starter content for standards, crew preferences, and playbooks — seeded by `install.sh` |
| `dashboard/server.js` | Status dashboard: vanilla HTTP server with JSON API + static file serving |
| `dashboard/public/` | Dashboard frontend: single-page HTML/CSS/JS, dark theme, auto-refresh |
| `dashboard/Dockerfile` | Lightweight dashboard container image (node only, no dev tools) |

### State Management

All state lives under `~/.commanddeck/` (override with `COMMANDDECK_STATE_DIR`). Structure:
```
~/.commanddeck/
  config.json              # Global installation config
  projects/<repo>/
    config.json
    directives/*.md
    missions/<id>/mission.json
  standards/*.md
  crew/<agent>-preferences.md
  playbooks/*.md
  channel-map.json
  pr-approvals.json
  proposed/index.json
```

Critical patterns:
- **Atomic locking:** All state mutations use `withMissionLock()` (mkdir-based lock)
- **Atomic writes:** tmp file + rename pattern
- **Version tracking:** Monotonic version counter on mission state

### Configuration

**Global config** at `~/.commanddeck/config.json` — installation-level settings:

| Field | Default | Description |
|---|---|---|
| `github_org` | `gulati8` | GitHub organization/user for repo creation |
| `domain` | `gulatilabs.me` | Domain for Caddy reverse proxy entries |
| `registry` | `ghcr.io/gulati8` | Container registry prefix for images |
| `caddyfile_path` | `/srv/proxy/Caddyfile` | Path to the Caddy configuration file |
| `caddy_container` | `proxy-caddy-1` | Docker container name for Caddy |
| `deploy_dir` | `/srv` | Base directory for deployed app stacks |

**Per-project config** at `~/.commanddeck/projects/<repo>/config.json` — project-specific overrides for workers, branches, test commands, model tiers.

**Environment variable overrides:**

| Variable | Description |
|---|---|
| `COMMANDDECK_STATE_DIR` | Override state directory (default `~/.commanddeck`) |
| `COMMANDDECK_PROJECT_DIR` | Override project clone directory (default `~/projects`) |
| `COMMANDDECK_CHANNEL_MAP` | Override channel-map.json path |
| `COMMANDDECK_MAX_WORKERS` | Max parallel workers per mission |
| `COMMANDDECK_MAX_SESSIONS` | Max sessions per mission |
| `COMMANDDECK_MAX_HOURS` | Max elapsed hours per mission |

**Precedence:** per-project config > global config > env vars > hardcoded defaults.

### Layered Context System

Loaded by `hooks/session-start.sh` in priority order:
1. Global standards (`~/.commanddeck/standards/*.md`)
2. Crew preferences (`~/.commanddeck/crew/<agent>-preferences.md`)
3. Project directives (`~/.commanddeck/projects/<repo>/directives/*.md`)
4. Repo ADRs (`docs/adr/*.md`)
5. Active mission state (mission.json, captains-log, briefings)

### Agent Identity & Model Tiers

- Agent identity, tools, and default model are defined in `agents/*.md` YAML frontmatter
- `lib/worker.js:loadAgentIdentity()` reads these files and prepends the markdown body to worker prompts
- Frontmatter `tools` array drives `--allowedTools` restrictions per agent
- **Model precedence:** per-project `config.json` model_overrides > `agents/*.md` frontmatter model > `COMMANDDECK_MODEL` env var > `claude-opus-4-6`

### Inter-Agent Communication

- **Briefings:** Downstream agents read upstream agent briefings from the mission state directory
- **Evidence bundles:** Contract between workers and the PR system — workers must always produce them

### Safety Guards

- `hooks/session-start.sh` loads layered context (standards, crew, directives, ADRs, mission state)
- `hooks/pre-write-guard.sh` blocks writes to `.env`, `.pem`, `.key`, secrets, credentials
- `hooks/pre-bash-guard.sh` blocks dangerous commands (rm -rf /, dd, mkfs, fork bombs)
- `hooks/pre-compact.sh` auto-commits and checkpoints before context compaction
- `hooks/post-edit.sh` post-edit cleanup and validation
- `lib/validate.js` validates git refs and repo names against injection
- Safety limits: max 50 sessions, max 6 hours, max 3 parallel workers, 45-min worker timeout

### Container Deployment

CommandDeck runs as a Docker container. Key setup:
- **Image:** Built via GH Actions → `ghcr.io/gulati8/commanddeck:latest`
- **Entrypoint:** `entrypoint.sh` handles SSH known_hosts, gh auth from `GH_TOKEN` env var, git config
- **Volumes:** State dir (persistent), projects dir (persistent), host SSH keys (read-only), Claude Code auth (read-write)
- **Networking:** Slack bot uses Socket Mode (outbound WebSocket) — no inbound ports required
- **PR creation:** Uses temp files instead of `/dev/stdin` for container compatibility

## Testing

- Place tests in `test/` with `*.test.js` suffix
- Tests use temp directories (`os.tmpdir()`) via `COMMANDDECK_STATE_DIR` for isolation
- No mocking library — tests use real file I/O with temp dirs and stub reporters
- Mirror module behavior: `describe` by module, `it` by scenario
