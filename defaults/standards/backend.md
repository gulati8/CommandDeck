# Backend Standards

## API Design
- RESTful with consistent resource naming (plural nouns, kebab-case)
- OpenAPI 3.1 spec as the source of truth
- Standard error format: { error: { code: "VALIDATION_ERROR", message: "...", details: [...] } }
- Pagination on all list endpoints (cursor-based preferred, offset acceptable)
- Rate limiting on public and auth endpoints

## Architecture
- Layered: routes > controllers > services > repositories
- Business logic in services, never in route handlers
- Data access in repositories, never in services directly
- Middleware for cross-cutting concerns (auth, logging, validation, CORS)

## Database
- All changes via migrations (never manual DDL)
- Parameterized queries only
- Index foreign keys and high-frequency query columns
- Connection pooling configured for expected concurrency
- Soft delete for user data, hard delete for system/ephemeral data

## Auth & Security
- bcrypt (cost >= 12) for password hashing
- JWT access tokens (short-lived) + refresh tokens (rotated)
- Validate all input at the API boundary
- Set security headers: HSTS, CSP, X-Content-Type-Options, X-Frame-Options
- Log security events (login, failed auth, permission denied)

## Error Handling
- Catch at route boundary, not deep in the stack
- Log with context (request ID, user ID, operation)
- Never log credentials, tokens, or PII
- 4xx for client errors, 5xx for server errors — never 200 for errors
