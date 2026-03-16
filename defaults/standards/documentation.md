# Documentation Standards

## Required Documentation
- README.md: project overview, setup, configuration, usage, deployment
- OpenAPI spec: auto-generated or hand-maintained, always up to date
- Architecture doc: system overview, component diagram (Mermaid), data flow
- User guide: feature documentation from the end-user perspective
- Operational runbook: deployment, monitoring, troubleshooting, rollback

## API Documentation
- OpenAPI 3.1 spec file in the repo (openapi.yaml or openapi.json)
- Every endpoint documented: method, path, parameters, request body, responses
- Example request/response for each endpoint
- Error codes and their meanings documented

## Architecture Documentation
- System overview with component diagram (use Mermaid for in-repo diagrams)
- Data model diagram showing entities and relationships
- Sequence diagrams for complex flows (auth, payment, etc.)
- Technology decisions documented in ADRs (docs/adr/)

## User Documentation
- Written from the user's perspective, not the developer's
- Task-oriented: "How to create an account", "How to manage settings"
- Include screenshots or UI descriptions for complex flows
- Keep up to date with the implementation — outdated docs are worse than no docs
