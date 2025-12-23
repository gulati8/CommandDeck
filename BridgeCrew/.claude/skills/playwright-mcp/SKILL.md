---
name: playwright-mcp
description: Playwright MCP setup and usage for browser automation, end-to-end UI testing, and retrofitting Playwright suites into existing projects. Use when configuring Claude Code MCP access, authoring Playwright tests, diagnosing UI bugs with automated browser flows, or adding Playwright test workflows/CI to a repo.
---

# Playwright MCP

## Overview

Use Playwright MCP to drive real browser flows, write stable UI tests, and retrofit a Playwright suite into an existing codebase. Prefer MCP-driven automation when available; fall back to standard Playwright CLI when MCP is not installed.

## Workflow Decision Tree

1. Need Playwright MCP access? Follow Setup.
2. Writing or updating UI tests? Follow Authoring.
3. Retrofitting tests into an existing app? Follow Retrofit.
4. Running in CI or debugging flakes? Follow CI & Troubleshooting.

## Setup

- Check MCP availability with `scripts/check-playwright-mcp.sh`.
- Bootstrap a minimal Playwright suite with `scripts/bootstrap-playwright.sh <project-root>`.
- Install the Playwright MCP plugin via Claude Code when missing:
  `/plugin install playwright@claude-plugins-official`
- Keep `.claude/mcp.manifest.json` in the project as a declarative reference.
- Do not auto-edit user-level MCP config from project scripts.

Detailed setup guidance: `references/mcp-usage.md`.

## Authoring UI Tests

- Prefer semantic locators and stable UI flows.
- Use MCP to explore DOM state, take screenshots, and capture trace/video.
- Write tests around user journeys, not isolated UI elements.
- Keep tests deterministic; avoid timeouts and brittle selectors.

Authoring details: `references/authoring-workflows.md`.

## Retrofit a Playwright Suite

- Map critical user flows; start with 1-3 high-value scenarios.
- Add a minimal Playwright config and folder structure.
- Add fixtures/test data helpers and page objects only when needed.
- Integrate with existing dev scripts and CI pipeline.

Retrofit steps: `references/retrofit-suite.md`.

## CI, Running, and Debugging

- Use Playwright CLI as a fallback when MCP is unavailable.
- Capture traces/screenshots/videos on failure for review.
- Keep CI retries low and prefer deterministic waits.

CI and troubleshooting references:
- `references/ci-and-running.md`
- `references/troubleshooting.md`
