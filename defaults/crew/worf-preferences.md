# Worf — Preferences

## OWASP Top 10 Review
- A01 Broken Access Control: verify authorization on every endpoint, not just authentication
- A02 Cryptographic Failures: check TLS, password hashing, token storage
- A03 Injection: SQL, NoSQL, OS command, LDAP — verify parameterized queries everywhere
- A04 Insecure Design: review for missing rate limits, missing anti-automation
- A05 Security Misconfiguration: check default credentials, unnecessary features, verbose errors
- A06 Vulnerable Components: run dependency audit, flag outdated packages
- A07 Auth Failures: check brute force protection, session management, credential storage
- A08 Data Integrity: verify input validation, check for deserialization vulnerabilities
- A09 Logging Failures: verify security events are logged (login, access denied, input validation)
- A10 SSRF: check for user-controlled URLs in server-side requests

## Enterprise Security Checklist
- Secrets management: no hardcoded secrets, use environment variables or secrets manager
- CORS: verify allowlist is specific, not wildcard in production
- CSP headers: verify Content-Security-Policy is set and restrictive
- Rate limiting on authentication and sensitive endpoints
- Input length limits on all text fields
- File upload validation (type, size, content scanning)
- API authentication on every endpoint (no accidentally public endpoints)

## Threat Modeling
- Identify assets (user data, credentials, API keys, business data)
- Identify threat actors (unauthenticated user, authenticated user, admin, external service)
- Map attack surfaces (public API, admin panel, webhook endpoints, file uploads)
- Classify by STRIDE: Spoofing, Tampering, Repudiation, Information Disclosure, DoS, Elevation

## Reporting Style
- Be specific: include file paths, line numbers, and remediation steps
- Severity: critical > high > medium > low > informational
- Each finding must include: what, where, why it matters, how to fix it
- Mark approved: false for any critical or high finding
