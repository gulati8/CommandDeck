# Skill-Based Pattern Recognition and Auto-Suggestion

The orchestrator system includes a comprehensive skills library in `.claude/skills/` that provides domain-specific knowledge and patterns. As orchestrator, you should proactively suggest relevant skills to agents based on task context.

## Skills Library Structure

```
.claude/skills/
├── frontend/           # React, Tailwind UI, component architecture
│   ├── react-best-practices.md
│   ├── tailwind-ui-patterns.md
│   ├── component-architecture.md
│   ├── testing-patterns.md
│   └── design-system-guide.md
├── backend/            # API design, authentication, database, caching
│   ├── api-design-patterns.md
│   ├── authentication-patterns.md
│   ├── database-patterns.md
│   └── caching-strategies.md
├── testing/            # TDD, integration, E2E, test data
│   ├── test-driven-development.md
│   ├── integration-testing-patterns.md
│   ├── e2e-testing-patterns.md
│   └── test-data-management.md
├── devops/             # CI/CD, IaC, monitoring, deployment
│   ├── ci-cd-patterns.md
│   ├── infrastructure-as-code.md
│   ├── monitoring-observability.md
│   └── deployment-strategies.md
├── security/           # OWASP, secure coding, secrets, threat modeling
│   ├── owasp-top-10.md
│   ├── secure-coding-practices.md
│   ├── secrets-management.md
│   └── threat-modeling.md
├── documentation/      # README best practices, doc structure
│   ├── readme-guide.md
│   └── structure-guide.md
├── orchestration/      # Task templates, delegation patterns
└── state-management/   # State tracking utilities
```

## Pattern Recognition Matrix

Use this matrix to automatically suggest skills based on task keywords and context:

| Task Keywords | Domain | Recommended Skills | Primary Agents |
|---------------|--------|-------------------|----------------|
| component, React, UI, interface | Frontend | `frontend/react-best-practices.md`<br>`frontend/component-architecture.md`<br>`frontend/tailwind-ui-patterns.md` | frontend-architect<br>premium-ux-designer<br>code-writer |
| button, card, modal, form | Design System | `frontend/design-system-guide.md`<br>`frontend/tailwind-ui-patterns.md` | frontend-architect<br>premium-ux-designer |
| API, endpoint, REST, GraphQL | Backend API | `backend/api-design-patterns.md`<br>`backend/authentication-patterns.md` | api-designer<br>code-writer |
| database, schema, query, migration | Database | `backend/database-patterns.md`<br>`backend/caching-strategies.md` | database-architect<br>code-writer |
| auth, login, JWT, session | Authentication | `backend/authentication-patterns.md`<br>`security/secure-coding-practices.md`<br>`security/secrets-management.md` | security-auditor<br>api-designer<br>code-writer |
| test, spec, coverage | Testing | `testing/test-driven-development.md`<br>`testing/integration-testing-patterns.md`<br>`frontend/testing-patterns.md` | test-writer<br>code-writer |
| E2E, Playwright, Cypress | End-to-End Testing | `testing/e2e-testing-patterns.md`<br>`testing/test-data-management.md` | test-writer |
| security, vulnerability, XSS, injection | Security | `security/owasp-top-10.md`<br>`security/secure-coding-practices.md`<br>`security/threat-modeling.md` | security-auditor<br>code-reviewer |
| secret, key, password, credential | Secrets Management | `security/secrets-management.md`<br>`security/secure-coding-practices.md` | security-auditor<br>devops-engineer |
| deploy, CI/CD, pipeline, Docker | DevOps | `devops/ci-cd-patterns.md`<br>`devops/infrastructure-as-code.md`<br>`devops/deployment-strategies.md` | devops-engineer |
| performance, optimize, slow | Performance | Reference performance-optimizer<br>May need database or frontend skills depending on bottleneck | performance-optimizer<br>database-architect (for queries)<br>frontend-architect (for React) |
| monitor, log, alert, observability | Monitoring | `devops/monitoring-observability.md` | devops-engineer<br>log-analyzer |
| README, documentation, docs, document | Documentation | `documentation/readme-guide.md`<br>`documentation/structure-guide.md` | documentation-writer<br>researcher |

## Auto-Suggestion Guidelines

When delegating tasks, **automatically include skill references** in your task templates:

**Example 1: Frontend Component Task**
```markdown
## Task
Design and implement a Button component for the design system

## Context
Creating a reusable Button component with variants and accessibility features

## Skills Reference
Please reference these skills during your work:
- `.claude/skills/frontend/component-architecture.md` - Component structure patterns
- `.claude/skills/frontend/tailwind-ui-patterns.md` - Styling with Tailwind
- `.claude/skills/frontend/design-system-guide.md` - Design system principles
- `.claude/skills/frontend/testing-patterns.md` - Component testing

## Agents Collaboration
This task involves:
1. frontend-architect: Define component API and architecture
2. premium-ux-designer: Create visual specifications
3. code-writer: Implement component
4. test-writer: Create tests
```

**Example 2: Security Audit Task**
```markdown
## Task
Perform security audit of authentication endpoints

## Context
Reviewing API authentication for vulnerabilities

## Skills Reference
Please reference these skills during your work:
- `.claude/skills/security/owasp-top-10.md` - Common vulnerabilities
- `.claude/skills/security/threat-modeling.md` - STRIDE framework
- `.claude/skills/security/secure-coding-practices.md` - Remediation patterns
- `.claude/skills/backend/authentication-patterns.md` - Secure auth patterns

## Agents Collaboration
This task involves:
1. security-auditor: Identify vulnerabilities using STRIDE
2. api-designer: Review API design for security issues
3. code-writer: Implement fixes
```

**Example 3: Database Optimization Task**
```markdown
## Task
Optimize slow database queries in order processing

## Context
Orders API experiencing high latency

## Skills Reference
Please reference these skills during your work:
- `.claude/skills/backend/database-patterns.md` - Query optimization patterns
- `.claude/skills/backend/caching-strategies.md` - Caching approaches
- `.claude/skills/devops/monitoring-observability.md` - Performance metrics

## Agents Collaboration
This task involves:
1. database-architect: Analyze queries and schema
2. performance-optimizer: Identify bottlenecks
3. code-writer: Implement optimizations
```

## Skill-Agent Affinity

When selecting agents for a task, consider their **natural affinity** with skills:

**High Affinity** (agent's primary domain):
- frontend-architect ↔ `frontend/` skills
- database-architect ↔ `backend/database-patterns.md`
- security-auditor ↔ `security/` skills
- devops-engineer ↔ `devops/` skills
- api-designer ↔ `backend/api-design-patterns.md`

**Medium Affinity** (agent can leverage these skills):
- code-writer ↔ ALL skills (implements based on any pattern)
- code-reviewer ↔ `security/`, `backend/`, `frontend/` (reviews against patterns)
- test-writer ↔ `testing/` skills (primary), others for context

**Skill Cross-Referencing**:
When multiple domains intersect, reference skills from both:
- Secure API → `backend/api-design-patterns.md` + `security/owasp-top-10.md`
- Frontend testing → `frontend/testing-patterns.md` + `testing/integration-testing-patterns.md`
- CI/CD security → `devops/ci-cd-patterns.md` + `security/secure-coding-practices.md`

## Proactive Skill Suggestion Examples

**Scenario 1**: User says "Add a login form"
```
As orchestrator, recognize keywords: "login", "form", "auth"
Auto-suggest:
- Skills: authentication-patterns.md, secure-coding-practices.md, tailwind-ui-patterns.md
- Agents: security-auditor (auth design), premium-ux-designer (form UI), code-writer (implementation)
```

**Scenario 2**: User says "App is slow"
```
As orchestrator, recognize keywords: "slow", "performance"
Auto-suggest:
- Skills: monitoring-observability.md (establish metrics first)
- Agents: performance-optimizer (analyze), log-analyzer (check logs)
- Then based on findings, suggest specific skills (database-patterns, caching-strategies, etc.)
```

**Scenario 3**: User says "Deploy to production"
```
As orchestrator, recognize keywords: "deploy", "production"
Auto-suggest:
- Skills: deployment-strategies.md, ci-cd-patterns.md, monitoring-observability.md
- Agents: devops-engineer (deployment), security-auditor (pre-deploy review)
```

## Multi-Agent Skill Collaboration

For complex features requiring multiple specialized agents, create a **skill routing plan**:

```markdown
## Task: Implement Secure Payment Processing

### Skill Routing Plan

**Phase 1: Design** (frontend-architect, api-designer, database-architect)
- Skills: api-design-patterns.md, database-patterns.md, authentication-patterns.md
- Coordination: feedback-coordinator manages architecture consensus

**Phase 2: Security Review** (security-auditor)
- Skills: threat-modeling.md, owasp-top-10.md, secrets-management.md
- Output: Security requirements and constraints for implementation

**Phase 3: Implementation** (code-writer)
- Skills: ALL above + secure-coding-practices.md
- References all architectural decisions and security requirements

**Phase 4: Testing** (test-writer)
- Skills: integration-testing-patterns.md, test-data-management.md
- Focus: Security test cases, payment flow tests

**Phase 5: Deployment** (devops-engineer)
- Skills: deployment-strategies.md, secrets-management.md, monitoring-observability.md
- Focus: Zero-downtime deployment with secret rotation
```

## Skill Discovery and Updates

As orchestrator, stay aware of:
1. **New skills added**: If user adds custom skills to `.claude/skills/`, incorporate them into your pattern matching
2. **Skill updates**: Skills are living documents - agents may suggest improvements
3. **Missing skills**: If a pattern emerges that lacks skill documentation, note this for potential skill creation

**Reporting skill gaps**:
```
"I notice we don't have a documented skill for {pattern}. Based on this work, I recommend creating `.claude/skills/{domain}/{pattern}.md` to capture this knowledge for future orchestrations."
```
