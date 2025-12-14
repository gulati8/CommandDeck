# Development vs Production Patterns

## The Core Problem

Development and production have different needs:

| Development | Production |
|-------------|------------|
| Hot-reload | Optimized build |
| Debug tools | Minimal image |
| Volume mounts | Baked-in code |
| Verbose logging | Structured logging |
| Local databases | External services |

## Simple Approach (Recommended)

### Single Dockerfile with ENV

Use environment variables to control behavior

**File**: `Dockerfile`

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Build if in production
RUN if [ "$NODE_ENV" = "production" ]; then npm run build; fi

USER node

EXPOSE 3000

# Different command based on ENV
CMD if [ "$NODE_ENV" = "production" ]; then \
      node dist/server.js; \
    else \
      npm run dev; \
    fi
```

**Usage**:
```bash
# Development
docker run -e NODE_ENV=development myapp

# Production
docker run -e NODE_ENV=production myapp
```

**Problem with this**: Single Dockerfile tries to handle both, becomes complex.

## Better: Separate Dockerfiles

### Dockerfile (Production)

**File**: `Dockerfile`

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

RUN npm run build

USER node

EXPOSE 3000

CMD ["node", "dist/server.js"]
```

### Dockerfile.dev (Development)

**File**: `Dockerfile.dev`

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

# Source mounted as volume in docker-compose

EXPOSE 3000

CMD ["npm", "run", "dev"]
```

### docker-compose.yml (Development)

**File**: `docker-compose.yml`

```yaml
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.dev
    ports:
      - "3000:3000"
    volumes:
      - ./src:/app/src           # Hot-reload
      - /app/node_modules        # Don't overwrite
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://postgres:password@database:5432/myapp
    depends_on:
      - database

  database:
    image: postgres:15-alpine
    ports:
      - "5432:5432"  # Expose for local tools
    environment:
      - POSTGRES_DB=myapp
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

**Usage**:
```bash
# Development
docker-compose up

# Production
docker build -t myapp:latest .
docker run -p 3000:3000 -e DATABASE_URL=$DB_URL myapp:latest
```

## Multi-Stage with Target

Best of both worlds: One Dockerfile, multiple targets

**File**: `Dockerfile`

```dockerfile
# Base stage - common dependencies
FROM node:18-alpine AS base
WORKDIR /app
COPY package*.json ./

# Development stage
FROM base AS development
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

# Build stage
FROM base AS builder
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM node:18-alpine AS production
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./
USER node
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

**File**: `docker-compose.yml`

```yaml
services:
  app:
    build:
      context: .
      target: development  # Use development stage
    ports:
      - "3000:3000"
    volumes:
      - ./src:/app/src
    depends_on:
      - database

  database:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=myapp
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

**Usage**:
```bash
# Development
docker-compose up

# Production (explicit target)
docker build --target production -t myapp:prod .
docker run -p 3000:3000 myapp:prod

# Or default (last stage is production)
docker build -t myapp:latest .
```

## Python Example

### Dockerfile (Production)

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install --no-cache-dir gunicorn

COPY . .

RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

CMD ["gunicorn", "--bind", "0.0.0.0:8000", "--workers", "4", "app:app"]
```

### Dockerfile.dev (Development)

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt requirements-dev.txt ./
RUN pip install --no-cache-dir -r requirements.txt -r requirements-dev.txt

EXPOSE 8000

CMD ["flask", "run", "--host=0.0.0.0", "--reload"]
```

### docker-compose.yml

```yaml
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.dev
    ports:
      - "8000:8000"
    volumes:
      - ./app:/app/app  # Hot-reload Python code
    environment:
      - FLASK_ENV=development
      - DATABASE_URL=postgresql://postgres:password@database:5432/myapp
    depends_on:
      - database

  database:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=myapp
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

## Go Example

Go doesn't need separate dev Dockerfile (fast recompilation)

**File**: `Dockerfile`

```dockerfile
FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o main .

FROM alpine:3.18
RUN apk --no-cache add ca-certificates
WORKDIR /app
COPY --from=builder /app/main .
RUN adduser -D -u 1000 appuser
USER appuser
EXPOSE 8080
CMD ["./main"]
```

**File**: `docker-compose.yml`

```yaml
services:
  app:
    build: .
    ports:
      - "8080:8080"
    volumes:
      - .:/app          # Mount source
    working_dir: /app
    command: go run main.go  # Override CMD for dev
    environment:
      - GO_ENV=development
    depends_on:
      - database

  database:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=myapp
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

**With hot-reload (Air)**:

```yaml
services:
  app:
    image: golang:1.21-alpine
    working_dir: /app
    volumes:
      - .:/app
    ports:
      - "8080:8080"
    command: sh -c "go install github.com/cosmtrek/air@latest && air"
    depends_on:
      - database

  database:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=myapp
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

## Key Differences

### Development Needs

```yaml
services:
  app:
    build:
      dockerfile: Dockerfile.dev
    volumes:
      - ./src:/app/src        # Hot-reload source code
      - /app/node_modules     # Don't overwrite dependencies
    environment:
      - DEBUG=true
      - LOG_LEVEL=debug
    ports:
      - "3000:3000"           # Direct port access
      - "9229:9229"           # Debugger port
```

### Production Needs

```dockerfile
# Optimized image
FROM node:18-alpine
WORKDIR /app

# Production dependencies only
RUN npm ci --only=production

# Built code (not source)
COPY --from=builder /app/dist ./dist

# Security
USER node

# Health monitoring
HEALTHCHECK CMD node healthcheck.js || exit 1

# Production command
CMD ["node", "dist/server.js"]
```

## Environment Configuration

### .env.development

```bash
NODE_ENV=development
LOG_LEVEL=debug
DATABASE_URL=postgresql://postgres:password@database:5432/myapp
REDIS_URL=redis://cache:6379
DEBUG=true
```

### .env.production

```bash
NODE_ENV=production
LOG_LEVEL=info
DATABASE_URL=postgresql://user:pass@prod-db.example.com:5432/myapp
REDIS_URL=redis://prod-cache.example.com:6379
DEBUG=false
```

### docker-compose.yml

```yaml
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.dev
    env_file:
      - .env.development
    ports:
      - "3000:3000"
```

## Choosing an Approach

### Use Single Dockerfile When:
- Very simple app
- Little difference between dev/prod
- Not using hot-reload

### Use Separate Dockerfiles When:
- Different dependencies (dev tools)
- Different base images
- Complex build process
- Clear separation preferred

### Use Multi-Stage with Targets When:
- Want single source of truth
- Shared base dependencies
- Multiple environments (dev, test, prod)

## Best Practices

1. **Development**: Fast iteration, debugging tools, hot-reload
2. **Production**: Optimized, secure, minimal, monitored
3. **Keep separate**: Don't try to make one Dockerfile do both
4. **Use docker-compose for dev**: Much easier than docker run
5. **Use environment variables**: Configure behavior without rebuilding
6. **Document both workflows**: README should show dev and prod usage

## Common Patterns

### Debug Mode

```dockerfile
# Install debugging tools in dev only
RUN if [ "$NODE_ENV" = "development" ]; then \
      npm install -g nodemon; \
    fi
```

### Source Maps

```javascript
// webpack.config.js
module.exports = {
  devtool: process.env.NODE_ENV === 'production'
    ? 'source-map'      // For error tracking
    : 'eval-source-map' // For debugging
}
```

### Database Seeding

```yaml
# docker-compose.yml
services:
  app:
    depends_on:
      database:
        condition: service_healthy
    command: sh -c "npm run db:seed && npm run dev"

  database:
    healthcheck:
      test: ["CMD", "pg_isready"]
```

## Keep It Simple

Most projects need:
1. **Dockerfile** - Production (optimized)
2. **Dockerfile.dev** - Development (hot-reload)
3. **docker-compose.yml** - Development workflow

Start here. Only add complexity (multi-stage targets, multiple compose files) when you need it.
