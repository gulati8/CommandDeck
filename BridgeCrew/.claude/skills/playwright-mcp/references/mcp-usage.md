# Playwright MCP Usage

## What MCP Provides

Playwright MCP exposes browser automation capabilities to Claude Code. Use it to:
- Navigate real pages and inspect DOM state
- Interact with forms and UI flows
- Capture screenshots, traces, and videos

## Install and Availability

Preferred install path (user-level):
- `/plugin install playwright@claude-plugins-official`

Check availability:
- `scripts/check-playwright-mcp.sh`

Notes:
- MCP servers are enabled at the user level via the plugin system.
- Do not auto-edit user MCP config from a project repository.
- Keep `.claude/mcp.manifest.json` as a declarative reference.

## When to Use MCP vs Playwright CLI

Use MCP when:
- Interactively exploring UI behavior
- Writing tests with live DOM inspection
- Debugging flaky UI flows with screenshots/traces

Use Playwright CLI when:
- Running in CI
- Running batch tests
- MCP is not available

## MCP Workflow (High-Level)

1. Start the app (dev server) and confirm base URL.
2. Use MCP browser automation to drive a user flow.
3. Capture artifacts (screenshot/trace) on failure.
4. Convert successful flows into Playwright test code.

## Security and Trust

Only enable MCP servers you trust. Prefer marketplace plugins and avoid running unvetted MCP commands.
