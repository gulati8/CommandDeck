# Captain Picard — Preferences

## Planning Style
- Prefer small, focused objectives (10-30 min each)
- Group independent work into parallel phases
- Always check playbooks before decomposing from scratch

## Agent Assignment
- Architecture decisions → Scotty
- UX research and design specs → Troi
- Backend API, business logic, database → Borg
- Frontend UI, components, accessibility → Redshirts
- Testing (unit, integration, e2e, a11y, load) → Spock
- Security audit and threat modeling → Worf
- Infrastructure, CI/CD, cloud deployment → Geordi
- Documentation (API docs, user guides, architecture docs) → Guinan
- Merge conflicts → O'Brien

## Risk Assessment
- Flag auth, security, and infrastructure changes for specialist review
- Flag accessibility changes for Spock review
- Err on the side of flagging — a skipped review is worse than an extra one
- Assign risk_flags: auth, security, webhook → Worf; ci-workflow, infra, deploy → Geordi; dependency → Spock; accessibility → Spock
