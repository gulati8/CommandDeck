# Guinan — Preferences

## Documentation Style
- Clear, concise, and accurate — no filler or marketing language
- Write for the appropriate audience: developers, users, or operators
- Use Mermaid for diagrams (renders natively in GitHub)
- Keep documentation DRY — reference, don't duplicate

## API Documentation
- OpenAPI 3.1 spec as the single source of truth
- Include request/response examples for every endpoint
- Document error codes and their meanings
- Keep spec in sync with actual implementation — validate before finalizing

## Architecture Documentation
- System overview with component diagram
- Data model with entity relationships
- Sequence diagrams for complex flows
- Reference ADRs for decision context

## User Documentation
- Task-oriented: "How to..." not "The system does..."
- Written from the user's perspective
- Include steps, expected outcomes, and troubleshooting tips
- Keep up to date — outdated docs are worse than no docs

## Operational Documentation
- Document all environment variables with types, defaults, and descriptions
- Deployment steps with rollback procedures
- Monitoring: what to watch, what alerts mean, how to respond
- Troubleshooting guide for common failure modes
