# CI and Running

## Local Running (CLI)

Common commands:
- `npx playwright test`
- `npx playwright test --ui`
- `npx playwright test --debug`
- `npx playwright show-report`

## CI Recommendations

- Prefer Playwright CLI in CI (not MCP).
- Install browsers in CI using `npx playwright install` (or cached images).
- Store `playwright-report/` and `test-results/` as artifacts.
- Keep retries low (0-2) and fix flaky tests.

## Env and Base URL

- Use `baseURL` in Playwright config.
- Use CI env vars for ports and credentials.
- Ensure test data seeding is idempotent.
