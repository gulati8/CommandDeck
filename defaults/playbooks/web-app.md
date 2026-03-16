# Full-Stack Web App — Decomposition Playbook

Use this template for enterprise-grade full-stack web applications.

## Phase 1 — Architecture (sequential)
- **System design** (scotty): Define system architecture, API contracts (OpenAPI), data models, cloud deployment target (AWS/Azure), technology decisions as ADRs. Output: architecture briefing with API spec, data model, component boundaries.

## Phase 2 — Design (sequential, depends on Phase 1)
- **UX research & design** (troi): Research domain-appropriate UX patterns, define user flows, produce component inventory, specify layout and responsive breakpoints, set accessibility requirements, choose design system. Output: design specification briefing.

## Phase 3 — Data & Backend (parallel, depends on Phase 1)
- **Database & migrations** (borg): Schema design, migrations, seed data, indexes — following Scotty's data model briefing.
- **Backend API** (borg): Implement endpoints, validation, business logic, auth, middleware — following Scotty's API contract.

## Phase 4 — Frontend (parallel, depends on Phase 2 + Phase 3)
- **Frontend implementation** (redshirts): Build UI components, pages, state management, API integration — following Troi's design spec and Scotty's API contract.

## Phase 5 — Quality (parallel, depends on Phase 3 + Phase 4)
- **Testing** (spock): Unit tests, integration tests, E2E tests with Playwright, accessibility audits with axe-core, load testing baselines.
- **Security review** (worf): OWASP Top 10 audit, secrets scan, threat model, dependency audit.

## Phase 6 — Infrastructure (depends on Phase 5)
- **CI/CD & deployment** (geordi): Dockerfile, GitHub Actions pipeline, cloud infrastructure (IaC), observability setup, health/readiness endpoints.

## Phase 7 — Documentation (depends on Phase 3 + Phase 4 + Phase 5)
- **Documentation** (guinan): OpenAPI spec validation, architecture docs, user guide, operational runbook, README, changelog.

## Dependency Graph
```
Scotty (1) → Troi (2) + Borg backend/data (3) → Redshirts (4) → Spock + Worf (5) → Geordi (6)
                                                                   Guinan (7) depends on 3+4+5
```

## Customization Notes
- Skip phases that don't apply (e.g., no frontend for API-only work)
- Split large phases into sub-objectives (keep each under 30 min)
- For API-only projects: skip Phase 2 (Troi) and Phase 4 (Redshirts)
- Add risk_flags for auth, security, infra, migration, dependency, accessibility changes
