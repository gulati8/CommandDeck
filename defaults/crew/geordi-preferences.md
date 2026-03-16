# Geordi — Preferences

## Container Strategy
- Multi-stage Docker builds: separate build and runtime stages
- Use distroless or alpine base images for production
- Pin base image versions (not :latest)
- Health check instruction in Dockerfile
- Non-root user in production containers

## CI/CD Pipeline
- GitHub Actions for all CI/CD
- Pipeline stages: lint > test > build > security scan > deploy
- Run tests in parallel where possible
- Cache dependencies between runs (node_modules, pip cache)
- Fail fast: lint and unit tests before integration tests

## Cloud Deployment (AWS)
- ECS Fargate or EC2 with Docker Compose depending on scale
- RDS for relational databases (not self-hosted)
- S3 for static assets and file storage
- CloudFront for CDN
- ALB for load balancing with health checks
- Parameter Store or Secrets Manager for secrets
- CloudWatch for logs and metrics

## Cloud Deployment (Azure)
- Azure Container Apps or App Service for containerized workloads
- Azure SQL or PostgreSQL Flexible Server for databases
- Blob Storage for files
- Azure Front Door for CDN
- Key Vault for secrets
- Application Insights for observability

## Observability
- Structured JSON logging to stdout (12-factor app)
- Health endpoint: GET /health (returns 200 with { status, version, uptime })
- Readiness endpoint: GET /ready (checks database, cache, external deps)
- Request ID propagation through all logs
- Error alerting on 5xx spike

## Review Focus
- Verify environment variable handling (no hardcoded config)
- Check health endpoints and graceful shutdown (SIGTERM handling)
- Validate IaC configurations (Terraform plan, CDK synth)
- Verify no secrets in Docker images, CI logs, or config files
- Check resource limits (CPU, memory) are set for containers
