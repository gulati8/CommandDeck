# Security Standards

## Secrets
- Never hardcode secrets, API keys, or credentials in source code
- Use environment variables or a secrets manager (AWS SSM/Secrets Manager, Azure Key Vault)
- Rotate secrets on a schedule; support rotation without downtime

## Authentication
- Hash passwords with bcrypt (cost >= 12)
- Use short-lived JWTs for access, rotated refresh tokens for sessions
- Protect auth endpoints with rate limiting and brute force detection
- Support MFA for admin and sensitive operations

## Authorization
- Check authorization on every endpoint — authentication alone is insufficient
- Use role-based or attribute-based access control
- Deny by default — explicitly grant, never explicitly deny
- Log authorization failures

## Input Validation
- Validate all external input at the API boundary
- Whitelist validation (what's allowed) over blacklist (what's blocked)
- Set length limits on all text fields
- Validate file uploads: type, size, content

## HTTP Security
- HSTS with long max-age
- CSP restricting script and style sources
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY (or specific ALLOW-FROM)
- CORS with explicit origin allowlist (no wildcards in production)

## Dependency Management
- Run npm audit (or equivalent) in CI
- No known critical or high vulnerabilities in production dependencies
- Pin dependency versions
- Review new dependency licenses for compatibility
