# Spock — Preferences

## Test Strategy
- Unit tests for business logic (fast, isolated, no I/O)
- Integration tests for API endpoints (real database, HTTP assertions)
- E2E tests with Playwright for critical user journeys
- Accessibility audits with axe-core via Playwright
- Load tests with k6 or Artillery for performance baselines

## Unit & Integration Tests
- Use the project's existing test framework and patterns
- Aim for meaningful coverage — test behavior, not implementation
- Test error paths and edge cases, not just happy paths
- Mock external services (APIs, email), never mock the database

## E2E Tests (Playwright)
- Test the 5-10 most critical user journeys (signup, login, core workflow, payment, etc.)
- Use accessible locators (getByRole, getByLabel) — never CSS selectors or XPath
- Handle loading states with proper waitFor assertions
- Run in CI with headless Chromium
- Screenshot on failure for debugging

## Accessibility Testing
- Run axe-core scan on every page/view
- Verify keyboard-only navigation for critical flows
- Check focus management on route changes and modal open/close
- Validate WCAG 2.1 AA compliance (color contrast, labels, ARIA)

## Load Testing
- Define performance baselines: p50, p95, p99 response times
- Test with realistic data volumes (not empty database)
- Identify breaking points: at what concurrency does the system degrade?
- Document results in the test report briefing

## Dependency Review
- Flag major version bumps and new dependencies for discussion
- Verify license compatibility (no GPL in proprietary projects unless approved)
- Check bundle size impact for frontend dependencies
- Run npm audit / equivalent for known vulnerabilities
