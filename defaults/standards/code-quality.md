# Code Quality Standards

## General

- Write clear, self-documenting code; add comments only when the "why" isn't obvious
- Follow the project's existing style (indentation, naming conventions, file structure)
- Keep functions focused — one responsibility per function
- Avoid dead code; delete rather than comment out

## Safety

- Never hardcode secrets, API keys, or credentials
- Use parameterized queries for database access
- Validate and sanitize all external input (user input, API responses)
- Use `execFileSync` over `execSync` to avoid shell injection

## Testing

- Every new feature or bug fix should include tests
- Tests must be deterministic — no flaky assertions on timing or order
- Use temp directories for file I/O tests; clean up after

## Dependencies

- Prefer standard library over third-party packages when reasonable
- Pin dependency versions in package.json
- Run `npm audit` before adding new dependencies
