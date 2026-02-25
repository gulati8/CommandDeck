# Web App — Decomposition Playbook

Use this template when building a typical web application feature.

## Phase 1 — Foundation (parallel)
- **API contract** (scotty): Define endpoints, request/response schemas, error codes
- **Data model** (mr-data): Schema design, migrations, seed data

## Phase 2 — Implementation (parallel, depends on Phase 1)
- **Backend API** (borg): Implement endpoints, validation, business logic
- **Frontend UI** (borg): Build components, forms, state management

## Phase 3 — Quality (parallel, depends on Phase 2)
- **Tests** (spock): Unit tests for logic, integration tests for API
- **Security review** (worf): Auth flows, input validation, secrets scan

## Phase 4 — Infrastructure (depends on Phase 3)
- **CI/CD & deploy** (geordi): Dockerfile, GitHub Actions, Caddy config

## Customization Notes
- Skip phases that don't apply (e.g., no frontend for API-only work)
- Split large phases into sub-objectives (keep each under 30 min)
- Add risk_flags for auth, security, infra, migration, dependency changes
