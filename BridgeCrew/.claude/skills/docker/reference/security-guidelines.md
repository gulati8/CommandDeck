# Docker Security Guidelines

## Critical Security Rules

### 🔴 NEVER Do These

1. **Never Run as Root in Production**
   ```dockerfile
   # BAD: Runs as root (uid 0)
   FROM node:18-alpine
   CMD ["node", "server.js"]

   # GOOD: Use non-root user
   FROM node:18-alpine
   USER node
   CMD ["node", "server.js"]
   ```

2. **Never Hardcode Secrets**
   ```dockerfile
   # BAD: Secret in image
   ENV API_KEY=secret123
   COPY .env /app/.env

   # GOOD: Secrets at runtime
   # Pass via: docker run -e API_KEY=$API_KEY myapp
   # Or: docker-compose env_file
   ```

3. **Never Use `latest` Tag**
   ```dockerfile
   # BAD: Unpredictable, breaks reproducibility
   FROM node:latest

   # GOOD: Pin specific version
   FROM node:18.17-alpine
   ```

4. **Never Include .git or Secrets in Image**
   ```
   # .dockerignore (REQUIRED)
   .git
   .env
   .env.*
   *.pem
   *.key
   secrets/
   credentials.json
   ```

## User Security

### Always Use Non-Root User

**Why**: If container is compromised, attacker has root access to container and potentially host.

**Implementation**:

```dockerfile
# Option 1: Use existing user from base image
FROM node:18-alpine
USER node  # Most official images include non-root user
WORKDIR /home/node/app
COPY --chown=node:node . .
CMD ["node", "server.js"]

# Option 2: Create custom user
FROM alpine:3.18
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser
WORKDIR /home/appuser
CMD ["./app"]

# Option 3: Use numeric UID (works everywhere)
FROM node:18-alpine
USER 1000:1000
WORKDIR /app
CMD ["node", "server.js"]
```

### File Permissions

```dockerfile
# Set proper ownership when copying files
COPY --chown=node:node package*.json ./
COPY --chown=node:node . .

# Or use numeric UIDs
COPY --chown=1000:1000 . .
```

## Secrets Management

### Runtime Secrets (Correct Approach)

**Environment Variables**:
```bash
# Pass at runtime
docker run -e DATABASE_PASSWORD=$DB_PASS myapp

# Or use env file
docker run --env-file .env myapp
```

**Docker Secrets (Swarm/Compose)**:
```yaml
# docker-compose.yml
services:
  app:
    secrets:
      - db_password

secrets:
  db_password:
    file: ./secrets/db_password.txt
```

**Application Code**:
```javascript
// Read secret at runtime
const dbPassword = process.env.DATABASE_PASSWORD;
```

### Verify No Secrets in Image

```bash
# Check image history for secrets
docker history myapp:latest

# Search for potential secrets
docker save myapp:latest | tar x -O | grep -i "password\|secret\|api_key"
```

## Base Image Security

### Use Official Images Only

```dockerfile
# GOOD: Official, maintained, scanned
FROM node:18-alpine
FROM python:3.11-slim
FROM postgres:15-alpine

# BAD: Random Docker Hub image
FROM randomuser/nodejs-app
```

**Verify Official**: Look for "Official Image" badge on Docker Hub.

### Prefer Minimal Images

```dockerfile
# Best: Alpine (smallest attack surface)
FROM node:18-alpine

# Good: Slim (small Debian-based)
FROM python:3.11-slim

# Avoid: Full images (larger attack surface)
FROM node:18  # 994MB vs alpine's 162MB
```

**Why**: Fewer packages = fewer vulnerabilities = smaller attack surface.

### Pin Specific Versions

```dockerfile
# BAD: Unpredictable
FROM node:18
FROM node:latest

# GOOD: Predictable
FROM node:18.17-alpine

# BEST: Pin digest for maximum security
FROM node:18.17-alpine@sha256:a1b2c3d4...
```

## Vulnerability Scanning

### Scan Images Regularly

**Docker Scout (Built-in)**:
```bash
# Scan image
docker scout cves myapp:latest

# Quick overview
docker scout quickview myapp:latest

# Compare to base image
docker scout compare --to node:18-alpine myapp:latest
```

**Trivy (Popular Alternative)**:
```bash
# Install trivy
brew install trivy

# Scan image
trivy image myapp:latest

# Scan with severity filter
trivy image --severity HIGH,CRITICAL myapp:latest

# Scan Dockerfile
trivy config Dockerfile
```

**Snyk**:
```bash
snyk container test myapp:latest
```

### CI/CD Integration

```yaml
# GitHub Actions example
- name: Scan Docker image
  run: |
    docker scout cves ${{ env.IMAGE }}
    # Fail if critical vulnerabilities found
```

## Network Security

### Minimize Exposed Ports

```dockerfile
# Only expose necessary ports
EXPOSE 3000

# Don't expose internal services
# EXPOSE 5432  # Database should not be exposed from app container
```

### Use Custom Networks

```yaml
# docker-compose.yml
services:
  app:
    networks:
      - frontend

  database:
    networks:
      - backend  # Not accessible from frontend

networks:
  frontend:
  backend:
```

### Disable Inter-Container Communication

```bash
# For security-critical setups
docker network create --opt com.docker.network.bridge.enable_icc=false isolated-network
```

## Input and Output Security

### Validate Environment Variables

```javascript
// Validate required env vars on startup
const requiredEnv = ['DATABASE_URL', 'API_KEY'];
for (const key of requiredEnv) {
  if (!process.env[key]) {
    console.error(`Missing required env var: ${key}`);
    process.exit(1);
  }
}
```

### Don't Log Sensitive Data

```javascript
// BAD: Logs password
console.log('DB connection:', process.env.DATABASE_URL);

// GOOD: Redact sensitive parts
const redactedUrl = process.env.DATABASE_URL.replace(/:([^@]+)@/, ':***@');
console.log('DB connection:', redactedUrl);
```

## Resource Limits

### Set Memory and CPU Limits

**docker-compose.yml**:
```yaml
services:
  app:
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 256M
```

**docker run**:
```bash
docker run --memory="512m" --cpus="0.5" myapp
```

**Why**: Prevents container from consuming all host resources (DoS protection).

### Set Container Limits

```bash
# Limit processes
docker run --pids-limit=100 myapp

# Read-only root filesystem
docker run --read-only myapp

# Disable new privileges
docker run --security-opt=no-new-privileges myapp
```

## Filesystem Security

### Use Read-Only Filesystem

```dockerfile
# docker-compose.yml
services:
  app:
    read_only: true
    tmpfs:
      - /tmp
      - /var/run
```

```bash
# docker run
docker run --read-only --tmpfs /tmp myapp
```

### Volume Permissions

```yaml
# Mount volumes with appropriate permissions
services:
  app:
    volumes:
      - ./data:/app/data:ro  # Read-only
      - ./uploads:/app/uploads  # Read-write only where needed
```

## Health Checks

### Implement Health Checks

```dockerfile
# Monitor container health
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD node healthcheck.js || exit 1
```

**healthcheck.js**:
```javascript
const http = require('http');

const options = {
  host: 'localhost',
  port: 3000,
  path: '/health',
  timeout: 2000
};

const req = http.request(options, (res) => {
  process.exit(res.statusCode === 200 ? 0 : 1);
});

req.on('error', () => process.exit(1));
req.end();
```

**Why**: Orchestrators can automatically restart unhealthy containers.

## Security Scanning Checklist

Before deploying to production:

```bash
# 1. Scan for vulnerabilities
docker scout cves myapp:latest

# 2. Check for secrets in image
docker history myapp:latest

# 3. Verify non-root user
docker inspect myapp:latest | jq '.[0].Config.User'

# 4. Check exposed ports
docker inspect myapp:latest | jq '.[0].Config.ExposedPorts'

# 5. Verify .dockerignore exists
test -f .dockerignore && echo "OK" || echo "MISSING"
```

## Common Vulnerabilities

### SQL Injection

```javascript
// BAD: Vulnerable to SQL injection
const query = `SELECT * FROM users WHERE id = ${userId}`;

// GOOD: Use parameterized queries
const query = 'SELECT * FROM users WHERE id = ?';
db.query(query, [userId]);
```

### Command Injection

```javascript
// BAD: Command injection risk
exec(`ping ${userInput}`);

// GOOD: Validate input
if (!/^[\w.-]+$/.test(userInput)) {
  throw new Error('Invalid input');
}
exec(`ping ${userInput}`);
```

### Path Traversal

```javascript
// BAD: Path traversal vulnerability
const filePath = path.join('/data', userInput);

// GOOD: Validate and normalize
const filePath = path.normalize(path.join('/data', userInput));
if (!filePath.startsWith('/data/')) {
  throw new Error('Invalid path');
}
```

## Security Best Practices Summary

### Dockerfile Security Checklist

- [ ] Use official base image with pinned version
- [ ] Non-root user specified
- [ ] .dockerignore excludes secrets and unnecessary files
- [ ] No hardcoded secrets in ENV or COPY commands
- [ ] Health check implemented
- [ ] Minimal base image (alpine/slim)
- [ ] Only necessary ports exposed
- [ ] Package manager caches cleaned up

### Runtime Security Checklist

- [ ] Secrets passed via environment variables
- [ ] Resource limits configured (memory, CPU)
- [ ] Read-only filesystem where possible
- [ ] Custom networks for isolation
- [ ] Security scanning in CI/CD pipeline
- [ ] Regular image updates for security patches
- [ ] Monitoring and logging enabled

### Code Security Checklist

- [ ] Input validation on all external data
- [ ] Parameterized queries (no SQL injection)
- [ ] Output escaping (no XSS)
- [ ] No sensitive data in logs
- [ ] Authentication and authorization implemented
- [ ] HTTPS/TLS for external communication
- [ ] Dependencies regularly updated

## Resources

- Docker Security Best Practices: https://docs.docker.com/develop/security-best-practices/
- CIS Docker Benchmark: https://www.cisecurity.org/benchmark/docker
- OWASP Container Security: https://cheatsheetseries.owasp.org/cheatsheets/Docker_Security_Cheat_Sheet.html
