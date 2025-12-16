---
description: Comprehensive security audit of codebase using STRIDE threat modeling
argument-hint: <scope> (e.g., "api", "auth", "full")
---

# Security Audit Workflow

This workflow performs a systematic security audit using threat modeling, vulnerability scanning, and security best practices review.

## Purpose

- Identify security vulnerabilities using STRIDE methodology
- Review authentication and authorization implementation
- Analyze input validation and output encoding
- Check for common OWASP Top 10 vulnerabilities
- Assess secrets management practices
- Review dependencies for known vulnerabilities

## Usage

```bash
# Full security audit
/project:security-audit full

# Focus on specific areas
/project:security-audit auth
/project:security-audit api
/project:security-audit database
/project:security-audit dependencies
```

## Workflow Phases

### Phase 1: Codebase Reconnaissance
**Agent**: researcher (model: haiku)
**Task**: Map security-critical components
- Locate authentication/authorization code
- Find API endpoints and routes
- Identify database query patterns
- Locate file upload handlers
- Find configuration and secrets files
- Map external dependencies

### Phase 2: Threat Modeling
**Agent**: security-auditor (model: sonnet)
**Task**: STRIDE threat analysis
- Create architecture diagram
- Identify trust boundaries
- Apply STRIDE to each component
- Map data flows
- Identify attack surfaces
- Assess risk (likelihood × impact)

### Phase 3: Authentication & Authorization Review
**Agent**: security-auditor (model: sonnet)
**Task**: Review access control
- Authentication mechanism analysis
- Session management review
- Password policy validation
- Token security (JWT, OAuth)
- Multi-factor authentication check
- Authorization logic review (RBAC/ABAC)
- Broken access control detection

### Phase 4: Input Validation & Injection
**Agent**: security-auditor (model: sonnet)
**Task**: Analyze injection vulnerabilities
- SQL injection patterns
- NoSQL injection patterns
- Command injection risks
- XSS vulnerabilities
- Input validation coverage
- Output encoding verification
- Path traversal checks

### Phase 5: Cryptography & Secrets
**Agent**: security-auditor (model: sonnet)
**Task**: Review cryptographic practices
- Password hashing (bcrypt/Argon2)
- Encryption at rest and in transit
- Certificate validation
- Secrets management (AWS Secrets Manager, Vault)
- Hardcoded secrets detection
- Key rotation practices

### Phase 6: Dependency Vulnerability Scan
**Agent**: debugger (model: sonnet)
**Task**: Analyze dependencies
- Run npm audit / yarn audit
- Check for outdated packages
- Identify packages with known CVEs
- Review dependency licenses
- Check for supply chain risks

### Phase 7: API Security Review
**Agent**: security-auditor (model: sonnet)
**Task**: Assess API security
- Rate limiting implementation
- CORS configuration
- Request size limits
- Authentication requirements
- Error message information leakage
- API versioning strategy

### Phase 8: Generate Security Report
**Agent**: documentation-writer (model: haiku)
**Task**: Compile findings
- Executive summary
- Critical vulnerabilities (by severity)
- Detailed findings with evidence
- STRIDE threat matrix
- Remediation recommendations (prioritized)
- Compliance checklist (OWASP Top 10)
- Metrics and statistics

### Phase 9: Create Remediation Plan
**Agent**: planner (model: sonnet)
**Task**: Plan fixes
- Prioritize vulnerabilities by risk
- Create actionable tasks
- Estimate effort for each fix
- Identify quick wins
- Plan long-term improvements

## Begin Orchestration

**Orchestrator Instructions:**

1. Parse scope argument:
   - "full" → Run all phases
   - "auth" → Run Phases 1, 2, 3
   - "api" → Run Phases 1, 2, 7
   - "database" → Run Phases 1, 2, 4
   - "dependencies" → Run Phase 6 only

2. Initialize state file:
   ```bash
   bash .claude/skills/state-management/utilities/init-state.sh "security-audit" "$ARGUMENTS"
   ```

3. For each phase, delegate to the specified agent

4. Pass context between phases:
   - Phase 1 output → All subsequent phases (reconnaissance data)
   - Phase 2 output → Phases 3-7 (threat model context)
   - Phases 3-7 output → Phase 8 (findings compilation)
   - Phase 8 output → Phase 9 (report for planning)

5. Update state after each phase:
   ```bash
   bash .claude/skills/state-management/utilities/update-step.sh "security-audit" "phase-1" "completed"
   ```

6. Severity classification:
   - **Critical**: Immediate exploitation possible, high impact
   - **High**: Exploitation likely, significant impact
   - **Medium**: Exploitation possible with effort, moderate impact
   - **Low**: Difficult to exploit or low impact
   - **Info**: No direct vulnerability, improvement recommended

7. Log all findings with:
   - Severity level
   - STRIDE category
   - OWASP category (if applicable)
   - File/line number
   - Proof of concept (if applicable)
   - Remediation steps

8. On completion:
   - Generate security-report.md in project root
   - Create remediation-plan.md
   - Output summary to console
   - Update state file with metrics

## Example Task Delegation

### Phase 2: Threat Modeling

```markdown
# Task: STRIDE Threat Model Analysis

## Context
Security audit of web application with focus on $SCOPE.

## Architecture Information
[Output from Phase 1]

## Requirements
Apply STRIDE threat modeling to identify security threats:
1. Create architecture diagram showing components and data flows
2. Identify trust boundaries
3. For each component, apply STRIDE:
   - Spoofing threats
   - Tampering threats
   - Repudiation threats
   - Information Disclosure threats
   - Denial of Service threats
   - Elevation of Privilege threats
4. Assess each threat (likelihood × impact)
5. Recommend mitigations

## Output Required
1. Architecture diagram (ASCII art)
2. Threat matrix (component × STRIDE)
3. Risk assessment for each threat
4. Top 10 highest-risk threats
5. Recommended mitigations

## References
Use the threat-modeling skill for STRIDE framework guidance.
```

### Phase 4: Input Validation Review

```markdown
# Task: Injection Vulnerability Analysis

## Context
Reviewing codebase for injection vulnerabilities.

## Components to Analyze
[From Phase 1: API routes, database queries, command execution]

## Requirements
Analyze for injection vulnerabilities:
1. **SQL Injection**
   - Check for string concatenation in queries
   - Verify parameterized queries are used
   - Test ORM usage patterns

2. **NoSQL Injection**
   - Review MongoDB/DynamoDB query patterns
   - Check for unsanitized object queries

3. **Command Injection**
   - Locate child_process/exec usage
   - Verify input sanitization

4. **XSS**
   - Check for dangerouslySetInnerHTML in React
   - Verify output encoding

5. **Path Traversal**
   - Review file system operations
   - Check path validation

## Output Required
For each finding:
- Severity (Critical/High/Medium/Low)
- File and line number
- Vulnerable code snippet
- Exploitation scenario
- Remediation code example

## References
Use owasp-top-10 and secure-coding-practices skills.
```

### Phase 9: Remediation Planning

```markdown
# Task: Create Security Remediation Plan

## Security Report
[Full output from Phase 8]

## Requirements
Create actionable remediation plan:
1. Group vulnerabilities by:
   - Severity
   - Component
   - Effort to fix

2. Prioritize using risk × effort matrix
3. Identify quick wins (high impact, low effort)
4. Plan phased approach:
   - Phase 1: Critical vulnerabilities
   - Phase 2: High-risk issues
   - Phase 3: Medium-risk improvements
   - Phase 4: Low-risk and nice-to-haves

5. For each item, provide:
   - Task description
   - Files to modify
   - Estimated effort (hours)
   - Implementation steps
   - Testing requirements

## Output Required
Markdown document with:
- Executive summary
- Prioritized task list
- Timeline recommendations
- Resource requirements
```

## Security Report Format

```markdown
# Security Audit Report

**Date**: YYYY-MM-DD
**Scope**: {full|api|auth|database}
**Auditor**: Security Auditor Agent

## Executive Summary

- Total vulnerabilities: X
- Critical: X | High: X | Medium: X | Low: X
- Top 3 risks: [list]
- Recommended immediate actions: [list]

## Findings by Severity

### Critical Vulnerabilities

#### [CVE-001] SQL Injection in User Query
- **Severity**: Critical
- **STRIDE**: Tampering, Information Disclosure
- **OWASP**: A03:2021 Injection
- **Location**: `src/api/users.ts:42`
- **Description**: User input directly concatenated into SQL query
- **Evidence**:
  ```typescript
  const query = `SELECT * FROM users WHERE id = '${req.params.id}'`;
  ```
- **Impact**: Full database compromise, data theft
- **Exploitation**: `'; DROP TABLE users; --`
- **Remediation**:
  ```typescript
  const query = 'SELECT * FROM users WHERE id = $1';
  await db.query(query, [req.params.id]);
  ```
- **Effort**: 1 hour

[Repeat for each finding...]

## STRIDE Threat Matrix

| Component | Spoofing | Tampering | Repudiation | Info Disclosure | DoS | Elevation |
|-----------|----------|-----------|-------------|-----------------|-----|-----------|
| Auth      | High     | Medium    | Low         | High            | Low | High      |
| API       | Medium   | High      | Medium      | High            | High| Medium    |
| Database  | Low      | High      | Low         | Critical        | Low | Medium    |

## Compliance Status

### OWASP Top 10 (2021)

- [ ] A01:2021 - Broken Access Control
- [ ] A02:2021 - Cryptographic Failures
- [X] A03:2021 - Injection
- [ ] A04:2021 - Insecure Design
- ...

## Metrics

- Files analyzed: X
- Lines of code: X
- Dependencies checked: X
- Vulnerabilities per 1000 LOC: X
- Security score: X/100

## Recommendations

1. **Immediate** (Within 1 week)
   - Fix critical SQL injection
   - Implement input validation
   - Add rate limiting

2. **Short-term** (Within 1 month)
   - Implement MFA
   - Update dependencies
   - Add security headers

3. **Long-term** (Within 3 months)
   - Implement secrets rotation
   - Add security scanning to CI/CD
   - Conduct penetration testing
```

## Success Criteria

- [ ] All security-critical code paths analyzed
- [ ] STRIDE threat model completed
- [ ] Top 10 vulnerabilities identified
- [ ] Dependency vulnerabilities scanned
- [ ] Comprehensive report generated
- [ ] Remediation plan created
- [ ] Findings prioritized by risk
- [ ] Code examples provided for fixes

## Notes

- Use owasp-top-10 skill for vulnerability patterns
- Use secure-coding-practices skill for remediation examples
- Use threat-modeling skill for STRIDE analysis
- Use secrets-management skill for credential review

Execute Phase 1 with scope: $ARGUMENTS
