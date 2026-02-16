# Repository Guidelines

## Project Structure & Module Organization
`commanddeck` is a Node.js CLI/Slack orchestration tool.
- `cli.js`: CLI entrypoint (`commanddeck` binary).
- `q.js`: core runtime wiring for mission, resume, learn, and status flows.
- `lib/`: core modules (mission execution, state, validation, Slack integration, risk/evidence, health checks).
- `test/`: Node test runner suites (`*.test.js`) for core behaviors.
- `agents/`: agent role definitions used by orchestration.
- `commands/`: command reference docs.
- `hooks/`: guard and lifecycle shell hooks.
- Root scripts: `install.sh`, `scaffold.sh`.

## Build, Test, and Development Commands
- `npm install`: install dependencies.
- `npm test`: run all tests with Node’s built-in test runner (`node --test test/*.test.js`).
- `npm run cli -- <command>`: run CLI commands locally, for example:
  - `npm run cli -- status`
  - `npm run cli -- run my-repo "implement health check"`
- `npm start`: starts `q.js` directly (used for runtime entry).

Use Node `>=20` (see `package.json` engines).

## Coding Style & Naming Conventions
- JavaScript uses CommonJS (`require/module.exports`) with strict mode (`'use strict';`).
- Follow existing formatting: 2-space indentation, single quotes, semicolons.
- File names in `lib/` are lowercase and domain-based (example: `observability.js`, `worktree.js`).
- Keep functions focused and explicit; validate external input early (see `lib/validate.js` patterns).

## Testing Guidelines
- Framework: `node:test` + `node:assert/strict`.
- Place tests in `test/` with `*.test.js` suffix.
- Mirror module behavior in test names (`describe` by module, `it` by scenario).
- Add/adjust tests for every behavior or validation change before opening a PR.
- No enforced coverage threshold is configured; maintain practical coverage of changed paths.

## Commit & Pull Request Guidelines
- Commit style in history is imperative and concise (examples: `Fix ...`, `Add ...`, `Clarify ...`).
- Prefer one logical change per commit; include tests in the same commit when applicable.
- PRs should include:
  - What changed and why.
  - Risk/impact notes (especially for mission flow, state, or safety guards).
  - Test evidence (`npm test` results).
  - Linked issue/task, plus CLI output snippets when behavior changes.

## Security & Configuration Tips
- Never commit secrets. Slack tokens and app credentials must come from environment variables.
- Respect existing safety guards around shell/git operations and ref validation.
