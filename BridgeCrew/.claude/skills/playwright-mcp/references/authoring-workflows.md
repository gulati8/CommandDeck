# Authoring Workflows

## Authoring Checklist

- Map the user journey end-to-end.
- Identify stable, semantic locators.
- Seed minimal, deterministic test data.
- Avoid arbitrary timeouts; wait on explicit conditions.
- Assert outcomes visible to users, not internal details.

## Locator Strategy

Use in this order:
1. `getByRole` with name
2. `getByLabel` / `getByPlaceholder`
3. `getByText` for non-interactive content
4. `getByTestId` only when needed

Avoid CSS selectors or DOM structure selectors unless unavoidable.

## Writing with MCP

- Use MCP to explore the DOM and verify locators.
- Capture screenshots of success and failure states.
- When a flow is stable, convert it into a Playwright test.

## Test Structure

- Prefer feature-based folders under `e2e/`.
- Keep tests small and independent.
- Use page objects only when multiple tests share complex flows.

## Stability Tips

- Use explicit waits (URL, text visible, element enabled).
- Avoid `waitForTimeout`.
- Keep fixtures minimal and clean up after tests.
