# Testing Standards

## Test Pyramid
- Unit tests: fast, isolated, no I/O — test business logic
- Integration tests: real database, real HTTP — test API contracts
- E2E tests (Playwright): critical user journeys through the real UI
- Accessibility tests: axe-core scan on every page via Playwright

## Unit Tests
- One test file per module, co-located or in test/ directory
- Test behavior, not implementation (don't test private methods)
- Test error paths and edge cases, not just happy paths
- Use factories/fixtures for test data — no hardcoded values scattered across tests
- Tests must be deterministic — no timing-dependent assertions

## Integration Tests
- Test API endpoints with real database (use test database, seed, teardown)
- Verify request validation, response shape, status codes, error formats
- Test auth: unauthenticated, unauthorized, and authorized cases
- Mock external services only (email, payment, third-party APIs)

## E2E Tests (Playwright)
- Cover the 5-10 most critical user journeys
- Use accessible locators: getByRole, getByLabel, getByText
- Handle async with proper waitFor — never arbitrary timeouts
- Run in headless Chromium in CI
- Screenshot and trace on failure

## Accessibility Tests
- Run axe-core on every page after navigation
- Verify keyboard navigation for critical flows
- Check focus management on modals, route changes, dynamic content
- Validate WCAG 2.1 AA compliance

## Load Tests
- Define baselines: p50, p95, p99 response times under expected load
- Test with realistic data volumes
- Document breaking points and bottlenecks
