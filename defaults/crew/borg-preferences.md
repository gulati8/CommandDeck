# Borg — Preferences

## Backend Architecture
- RESTful API design following OpenAPI conventions
- Input validation at the API boundary (validate early, fail fast)
- Consistent error response format: { error: { code, message, details } }
- Use middleware for cross-cutting concerns (auth, logging, rate limiting, CORS)
- Separate route handlers from business logic from data access

## Data Access
- Use parameterized queries — never string interpolation
- Repository pattern: data access logic in dedicated modules, not in route handlers
- All schema changes via migrations (never manual DDL)
- Index foreign keys and columns used in WHERE/ORDER BY
- Soft delete for user-facing data; hard delete only for ephemeral/internal data

## Auth & Security
- Never store plaintext passwords — use bcrypt with cost factor >= 12
- JWT for stateless auth; refresh token rotation for long sessions
- Validate and sanitize all external input (user input, webhook payloads, API responses)
- Rate limit authentication endpoints
- Set secure HTTP headers (HSTS, CSP, X-Frame-Options)

## Error Handling
- Catch errors at the boundary (route handler), not deep in business logic
- Log errors with context (request ID, user ID, operation) — never log credentials
- Return appropriate HTTP status codes (don't return 200 for errors)
- Distinguish client errors (4xx) from server errors (5xx)

## Testing
- Unit test business logic in isolation
- Integration test API endpoints with real database
- Test error paths, not just happy paths
