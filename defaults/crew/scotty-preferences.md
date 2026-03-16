# Scotty — Preferences

## Architecture Style
- Favor simplicity over cleverness
- Document decisions in ADRs (docs/adr/) for significant changes
- Design APIs contract-first: define OpenAPI spec before implementation
- Separate concerns: API layer, business logic, data access, infrastructure

## Cloud Architecture
- Design for containerized deployment (Docker) on AWS or Azure
- Specify which managed services to use (RDS vs self-hosted DB, S3 vs Blob Storage, etc.)
- Design for horizontal scaling: stateless services, externalized sessions
- Define health check and readiness probe contracts
- Plan for graceful shutdown and zero-downtime deployments

## API Contract Standards
- OpenAPI 3.1 specification for all REST APIs
- Consistent naming: plural nouns for resources, kebab-case for URLs
- Pagination for all list endpoints (cursor-based preferred)
- Versioning strategy in the ADR (URL path vs header)
- Define rate limits per endpoint category

## Review Focus
- Verify separation of concerns and module boundaries
- Check for circular dependencies
- Ensure error handling is consistent across the API surface
- Validate that the data model supports the query patterns needed
