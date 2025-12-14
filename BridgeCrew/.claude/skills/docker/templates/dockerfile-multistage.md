# Multi-Stage Build Patterns

Multi-stage builds create smaller, more secure production images by separating build-time from runtime dependencies.

## Why Multi-Stage Builds?

**Problem**: Build tools bloat production images
- Compilers, build tools, dev dependencies
- Source code, test files, documentation
- Package manager caches

**Solution**: Build in one stage, copy only what's needed to run

**Benefits**:
- 50-90% smaller images
- Faster deployments
- Fewer security vulnerabilities
- No build artifacts in production

## Basic Pattern

```dockerfile
# Stage 1: Build
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Production
FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY package*.json ./
RUN npm ci --only=production
CMD ["node", "dist/server.js"]
```

**How it works**:
1. `AS builder` names the first stage
2. `--from=builder` copies files from that stage
3. Final image only contains production stage
4. Builder stage is discarded

## Node.js Multi-Stage

### TypeScript Build

```dockerfile
# Build stage
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
RUN npm prune --production

# Production stage
FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./
USER node
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

### Next.js

```dockerfile
FROM node:18-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:18-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
```

## Python Multi-Stage

### Flask/Django with Compiled Dependencies

```dockerfile
# Build stage
FROM python:3.11-slim AS builder
WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y gcc && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --user --no-cache-dir -r requirements.txt

# Production stage
FROM python:3.11-slim
WORKDIR /app

# Copy installed packages
COPY --from=builder /root/.local /root/.local
ENV PATH=/root/.local/bin:$PATH

COPY . .

RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "app:app"]
```

### With Static Asset Compilation

```dockerfile
# Build static assets
FROM node:18-alpine AS asset-builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY webpack.config.js .
COPY static ./static
RUN npm run build

# Build Python dependencies
FROM python:3.11-slim AS python-builder
WORKDIR /app
COPY requirements.txt .
RUN pip install --user --no-cache-dir -r requirements.txt

# Production
FROM python:3.11-slim
WORKDIR /app

COPY --from=python-builder /root/.local /root/.local
COPY --from=asset-builder /app/dist ./static/dist
ENV PATH=/root/.local/bin:$PATH

COPY . .

RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "app:app"]
```

## Go Multi-Stage

### Standard Pattern

```dockerfile
# Build stage
FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o main .

# Production stage
FROM alpine:3.18
RUN apk --no-cache add ca-certificates
WORKDIR /app
COPY --from=builder /app/main .
RUN adduser -D -u 1000 appuser
USER appuser
EXPOSE 8080
CMD ["./main"]
```

### Minimal (Scratch)

```dockerfile
FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o main .

FROM scratch
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=builder /app/main /app/main
USER 65534
EXPOSE 8080
ENTRYPOINT ["/app/main"]
```

## Rust Multi-Stage

```dockerfile
# Build stage
FROM rust:1.73-alpine AS builder
RUN apk add --no-cache musl-dev
WORKDIR /app
COPY Cargo.toml Cargo.lock ./
# Build dependencies first (caching)
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release
RUN rm -rf src
# Build actual app
COPY src ./src
RUN cargo build --release

# Production stage
FROM alpine:3.18
RUN apk --no-cache add ca-certificates
WORKDIR /app
COPY --from=builder /app/target/release/myapp .
RUN adduser -D -u 1000 appuser
USER appuser
EXPOSE 8080
CMD ["./myapp"]
```

## Java Multi-Stage

### Maven

```dockerfile
# Build stage
FROM maven:3.9-eclipse-temurin-17 AS builder
WORKDIR /app
COPY pom.xml .
RUN mvn dependency:go-offline
COPY src ./src
RUN mvn package -DskipTests

# Production stage
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=builder /app/target/*.jar app.jar
RUN adduser -D -u 1000 appuser
USER appuser
EXPOSE 8080
CMD ["java", "-jar", "app.jar"]
```

### Gradle

```dockerfile
FROM gradle:8.4-jdk17 AS builder
WORKDIR /app
COPY build.gradle settings.gradle ./
COPY src ./src
RUN gradle build --no-daemon

FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=builder /app/build/libs/*.jar app.jar
RUN adduser -D -u 1000 appuser
USER appuser
EXPOSE 8080
CMD ["java", "-jar", "app.jar"]
```

## Advanced Patterns

### Multiple Source Stages

```dockerfile
# Stage 1: Build frontend
FROM node:18-alpine AS frontend
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Build backend
FROM golang:1.21-alpine AS backend
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o main .

# Stage 3: Production
FROM alpine:3.18
RUN apk --no-cache add ca-certificates
WORKDIR /app
COPY --from=backend /app/main .
COPY --from=frontend /app/dist ./static
RUN adduser -D -u 1000 appuser
USER appuser
EXPOSE 8080
CMD ["./main"]
```

### Testing Stage

```dockerfile
# Dependencies
FROM node:18-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Testing stage
FROM deps AS test
COPY . .
RUN npm test

# Build stage (only runs if tests pass)
FROM deps AS builder
COPY . .
RUN npm run build

# Production
FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
USER node
CMD ["node", "dist/server.js"]
```

**Build with testing**:
```bash
docker build --target test -t myapp:test .  # Run tests
docker build -t myapp:latest .              # Build production
```

### Shared Base Stage

```dockerfile
# Base stage with common dependencies
FROM python:3.11-slim AS base
RUN apt-get update && apt-get install -y libpq5 && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Development stage
FROM base AS development
RUN apt-get update && apt-get install -y gcc && rm -rf /var/lib/apt/lists/*
COPY requirements.txt requirements-dev.txt ./
RUN pip install -r requirements.txt -r requirements-dev.txt
COPY . .
CMD ["python", "-m", "flask", "run", "--host=0.0.0.0"]

# Production builder
FROM base AS builder
RUN apt-get update && apt-get install -y gcc && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --user --no-cache-dir -r requirements.txt

# Production
FROM base AS production
COPY --from=builder /root/.local /root/.local
ENV PATH=/root/.local/bin:$PATH
COPY . .
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "app:app"]
```

**Build different stages**:
```bash
docker build --target development -t myapp:dev .
docker build --target production -t myapp:prod .
```

## Optimization Tips

### 1. Order Stages by Dependency

```dockerfile
# Good: Stable dependencies first
FROM node:18-alpine AS deps
COPY package*.json ./
RUN npm ci

FROM deps AS builder
COPY . .
RUN npm run build

FROM node:18-alpine
COPY --from=builder /app/dist ./dist
```

### 2. Copy Only What's Needed

```dockerfile
# Bad: Copies everything including build artifacts
COPY --from=builder /app .

# Good: Copy only production artifacts
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
```

### 3. Minimize Production Image

```dockerfile
# Build in full image
FROM node:18 AS builder
# ... build steps

# Run in minimal image
FROM node:18-alpine
COPY --from=builder /app/dist ./dist
```

### 4. Cache Dependencies Separately

```dockerfile
# Dependencies change less often than code
COPY package*.json ./
RUN npm ci

# Code changes more often
COPY . .
RUN npm run build
```

## When to Use Multi-Stage

**Use when**:
- App requires compilation (TypeScript, Go, Java, Rust)
- Build tools are large (webpack, babel, compilers)
- Dev dependencies are separate from prod
- Image size matters (>200MB)

**Don't use when**:
- Simple interpreted scripts (Python/Node without build step)
- Image is already small (<100MB)
- No separation between build and runtime dependencies

## Measuring Impact

**Check image sizes**:
```bash
# Single stage
docker images myapp:single
# myapp    single    500MB

# Multi-stage
docker images myapp:multi
# myapp    multi     150MB
```

**Inspect what's in each stage**:
```bash
docker build --target builder -t myapp:builder .
docker images myapp:builder
```

## Keep It Simple

Don't use multi-stage builds unless you need them:
1. **Single stage** → Start here (most Python/Node apps)
2. **Two stages** → When you have a build step (TypeScript, Go)
3. **Three+ stages** → Only for complex builds (frontend + backend, testing)

Multi-stage builds add complexity. Use them when the benefit (smaller image, faster deploy) is worth it.
