# Docker Best Practices

## Base Images

### Use Official Images
- Always prefer official images: `node:18-alpine`, `python:3.11-slim`, `postgres:15-alpine`
- Official images are maintained, secure, and optimized
- Check Docker Hub for official image badges

### Prefer Alpine or Slim Variants
- **Alpine**: Smallest size (~5MB base), uses apk package manager
  - Example: `node:18-alpine` (162MB vs node:18 at 994MB)
- **Slim**: Minimal Debian-based (~50MB base), uses apt
  - Example: `python:3.11-slim`
- Use full images only when you need specific system packages

### Pin Specific Versions
```dockerfile
# BAD: Will break when new version releases
FROM node:latest

# GOOD: Predictable, reproducible builds
FROM node:18.17-alpine

# BEST: Pin exact digest for maximum reproducibility
FROM node:18.17-alpine@sha256:abc123...
```

## Dockerfile Optimization

### Layer Ordering (Least to Most Frequently Changing)
```dockerfile
# 1. Base image (changes rarely)
FROM node:18-alpine

# 2. System dependencies (changes rarely)
RUN apk add --no-cache git

# 3. Working directory (never changes)
WORKDIR /app

# 4. Package files (changes occasionally)
COPY package*.json ./

# 5. Install dependencies (changes when packages change)
RUN npm ci

# 6. Source code (changes frequently)
COPY . .

# 7. Runtime command (rarely changes)
CMD ["npm", "start"]
```

**Why**: Docker caches layers. Ordering by change frequency maximizes cache hits.

### Use .dockerignore
Create `.dockerignore` to exclude unnecessary files:
```
node_modules
npm-debug.log
.git
.env
.env.*
*.md
.DS_Store
coverage
.vscode
```

**Benefits**: Smaller context, faster builds, no secrets leakage

### Minimize Layers
```dockerfile
# BAD: 3 layers
RUN apt-get update
RUN apt-get install -y curl
RUN apt-get clean

# GOOD: 1 layer
RUN apt-get update && \
    apt-get install -y curl && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*
```

**When to combine**: RUN commands that logically belong together
**When to separate**: Steps that change at different frequencies

### Clean Up in Same Layer
```dockerfile
# BAD: Deletion in new layer doesn't reduce image size
RUN apt-get update && apt-get install -y build-tools
RUN rm -rf /var/lib/apt/lists/*

# GOOD: Clean up in same layer
RUN apt-get update && \
    apt-get install -y build-tools && \
    rm -rf /var/lib/apt/lists/*
```

## Security

### Never Run as Root
```dockerfile
# BAD: Runs as root (uid 0)
CMD ["node", "server.js"]

# GOOD: Use named user
USER node
CMD ["node", "server.js"]

# GOOD: Use numeric UID (works everywhere)
USER 1000:1000
CMD ["node", "server.js"]
```

**Why**: Compromised container = compromised root access

### Don't Include Secrets in Images
```dockerfile
# BAD: Secrets baked into image
COPY .env /app/.env
ENV API_KEY=secret123

# GOOD: Secrets via environment at runtime
# (Pass via docker run -e or docker-compose env_file)
```

**Check secrets**: `docker history <image>` shows all layers

### Scan Images for Vulnerabilities
```bash
# Using Docker Scout (built-in)
docker scout cves <image>

# Using Trivy
trivy image <image>
```

### Use Minimal Base Images
- Smaller image = smaller attack surface
- Fewer packages = fewer vulnerabilities
- Alpine has ~5MB base vs ~100MB for full Debian

## Size Optimization

### Multi-Stage Builds
```dockerfile
# Build stage with all build tools
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage with only runtime
FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
USER node
CMD ["node", "dist/server.js"]
```

**Benefits**: Final image excludes build tools, source code, dev dependencies

### Remove Dev Dependencies
```dockerfile
# Production install only
RUN npm ci --only=production

# Or after build
RUN npm prune --production
```

### Use npm ci Instead of npm install
```dockerfile
# BAD: Slow, uses package.json ranges
RUN npm install

# GOOD: Fast, uses exact versions from lock file
RUN npm ci
```

**Benefits**: 2-10x faster, reproducible builds

## Development vs Production

### Separate Concerns
```
Dockerfile          # Production (optimized)
Dockerfile.dev      # Development (hot-reload)
```

### Development Dockerfile
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
EXPOSE 3000
# Source mounted as volume in docker-compose
CMD ["npm", "run", "dev"]
```

### Production Build Process
```bash
# Build
docker build -t myapp:latest .

# Test locally
docker run -p 3000:3000 myapp:latest

# Tag for registry
docker tag myapp:latest registry.example.com/myapp:v1.0.0

# Push
docker push registry.example.com/myapp:v1.0.0
```

## Health Checks

### Always Include Health Checks
```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD node healthcheck.js || exit 1
```

### Simple HTTP Health Check
```dockerfile
# Using wget
HEALTHCHECK CMD wget --spider -q http://localhost:3000/health || exit 1

# Using curl
HEALTHCHECK CMD curl -f http://localhost:3000/health || exit 1
```

**Why**: Orchestrators (Docker, Kubernetes) use health checks for:
- Knowing when container is ready
- Automatic restarts of unhealthy containers
- Load balancer traffic routing

## Common Patterns

### COPY vs ADD
```dockerfile
# GOOD: Use COPY for local files
COPY package*.json ./
COPY src ./src

# BAD: ADD has implicit behaviors
ADD package.json ./

# ONLY use ADD for URLs or auto-extracting tars
ADD https://example.com/file.tar.gz /tmp/
```

### Environment Variables
```dockerfile
# Set defaults in Dockerfile
ENV NODE_ENV=production
ENV PORT=3000

# Override at runtime
# docker run -e NODE_ENV=development myapp
```

### EXPOSE Documentation
```dockerfile
# Documents port (doesn't actually publish)
EXPOSE 3000

# Publish at runtime
# docker run -p 3000:3000 myapp
```

## Keep It Simple (KISS)

### Don't Over-Optimize Prematurely
```dockerfile
# GOOD: Simple, clear, works
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
EXPOSE 3000
CMD ["npm", "start"]

# BAD: Premature optimization
FROM node:18-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci
FROM node:18-alpine AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build
FROM node:18-alpine AS runner
# ... (complex multi-stage for no benefit)
```

**Start simple. Optimize when you measure a problem.**

## Quick Checklist

Before committing Dockerfile:
- [ ] Using official base image with pinned version
- [ ] .dockerignore excludes unnecessary files
- [ ] Layers ordered by change frequency
- [ ] No secrets in image
- [ ] Non-root user in production
- [ ] Health check included
- [ ] Cleaned up package manager caches
- [ ] Exposed ports documented
- [ ] ENV variables for configuration
