# Cloud Deployment Standards

## Container Requirements
- Multi-stage Docker builds (build + runtime)
- Non-root user in production
- Health check instruction in Dockerfile
- Pin base image versions
- .dockerignore excludes node_modules, .git, tests, docs

## Environment Configuration
- 12-factor app: all config via environment variables
- Required vars validated at startup (fail fast, not at first use)
- Default to safe values (e.g., debug=false, CORS=restrictive)
- Document all environment variables in README and .env.example

## Health & Readiness
- GET /health: always returns 200 if process is alive (liveness)
- GET /ready: returns 200 only when all dependencies are connected (readiness)
- Include: { status, version, uptime } in health response

## Deployment
- Zero-downtime deployments (rolling update or blue-green)
- Graceful shutdown: handle SIGTERM, drain connections, close DB pools
- Database migrations run before new version starts (not during)
- Rollback plan documented for every deployment

## Observability
- Structured JSON logging to stdout
- Request ID generated at ingress, propagated through all logs
- Log levels: error (pages someone), warn (investigate soon), info (audit trail), debug (development)
- Metrics: request count, latency (p50/p95/p99), error rate, saturation
