# Retrofit a Playwright Suite

## Step 1: Identify the Runtime

- Confirm how the app runs locally (dev server command and port).
- Define the base URL for Playwright.
- Identify any required env vars or seed data.

## Step 2: Add Minimal Structure

- Create `e2e/` (or `tests/e2e/`) and `playwright.config.*`.
- Add a single smoke test that validates the home page or login.

## Step 3: Stabilize the First Test

- Replace brittle selectors with semantic locators.
- Use deterministic test data or fixture setup.
- Add screenshots/traces on failure.

## Step 4: Expand Coverage

- Add 1-3 critical user journeys.
- Introduce page objects only when duplication appears.
- Add data setup helpers and cleanup hooks.

## Step 5: Integrate with CI

- Add a script entry for Playwright tests.
- Run headless in CI; store reports as artifacts.
- Keep retries low; fix flakes rather than masking.
