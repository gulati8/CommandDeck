# Node.js Dockerfile Templates

## Simple Production Dockerfile

**Location**: Place in your Node.js application root

**File**: `Dockerfile`

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy dependency files first (better caching)
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Use non-root user
USER node

# Document the port
EXPOSE 3000

# Start the application
CMD ["node", "server.js"]
```

**Usage**:
```bash
# Build
docker build -t myapp:latest .

# Run
docker run -p 3000:3000 myapp:latest
```

## Development Dockerfile

**File**: `Dockerfile.dev`

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy dependency files
COPY package*.json ./

# Install all dependencies (including dev)
RUN npm install

# Source code will be mounted as volume in docker-compose

EXPOSE 3000

# Run in development mode with hot-reload
CMD ["npm", "run", "dev"]
```

**With docker-compose.yml**:
```yaml
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.dev
    volumes:
      - ./src:/app/src          # Hot-reload source
      - /app/node_modules       # Don't overwrite installed modules
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
```

## Production with Build Step

For apps with build steps (TypeScript, webpack, etc.)

**File**: `Dockerfile`

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy dependency files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build application
RUN npm run build

# Remove dev dependencies
RUN npm prune --production

# Use non-root user
USER node

EXPOSE 3000

# Run built application
CMD ["node", "dist/server.js"]
```

## Multi-Stage Build (Optimized)

Smallest production image by excluding build tools and source

**File**: `Dockerfile`

```dockerfile
# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Copy only production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy built application from builder
COPY --from=builder /app/dist ./dist

# Use non-root user
USER node

EXPOSE 3000

CMD ["node", "dist/server.js"]
```

**Benefits**:
- Smaller final image (no build tools, no source files)
- More secure (fewer packages)
- Faster deployment

## With Native Dependencies

For apps using native modules (bcrypt, sharp, etc.)

**File**: `Dockerfile`

```dockerfile
FROM node:18-alpine

# Install build tools for native dependencies
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./

# Install with native compilation
RUN npm ci --only=production

# Remove build tools (smaller image)
RUN apk del python3 make g++

COPY . .

USER node

EXPOSE 3000

CMD ["node", "server.js"]
```

## Express.js Application

**File**: `Dockerfile`

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

# Create non-root user if not using node user
RUN chown -R node:node /app
USER node

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD node healthcheck.js || exit 1

CMD ["node", "server.js"]
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

## Next.js Application

**File**: `Dockerfile`

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

**next.config.js** (required):
```javascript
module.exports = {
  output: 'standalone',
}
```

## NestJS Application

**File**: `Dockerfile`

```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/dist ./dist

USER node

EXPOSE 3000

CMD ["node", "dist/main.js"]
```

## Monorepo (Single App)

**File**: `apps/backend/Dockerfile`

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy root package files
COPY package*.json ./
COPY apps/backend/package*.json ./apps/backend/

# Install all dependencies (monorepo needs root dependencies)
RUN npm ci

# Copy only this app's code
COPY apps/backend ./apps/backend

WORKDIR /app/apps/backend

USER node

EXPOSE 3000

CMD ["node", "server.js"]
```

## With Environment Configuration

**File**: `Dockerfile`

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

USER node

EXPOSE 3000

# Environment variables (with defaults)
ENV NODE_ENV=production \
    PORT=3000 \
    LOG_LEVEL=info

# Override at runtime:
# docker run -e PORT=8080 -e LOG_LEVEL=debug myapp

CMD ["node", "server.js"]
```

## Best Practices Checklist

When creating Node.js Dockerfile:

- [ ] Use `node:18-alpine` or similar official image
- [ ] Pin specific version (e.g., `node:18.17-alpine`)
- [ ] Copy `package*.json` before source code
- [ ] Use `npm ci` instead of `npm install`
- [ ] Use `--only=production` flag for production
- [ ] Run as non-root user (`USER node`)
- [ ] Use `WORKDIR /app`
- [ ] Document ports with `EXPOSE`
- [ ] Use environment variables for config
- [ ] Include health check for production
- [ ] Create `.dockerignore` file
- [ ] Consider multi-stage builds for optimization

## Common Patterns

### Install Specific npm Version

```dockerfile
RUN npm install -g npm@9.8.1
```

### Use Yarn Instead

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production

COPY . .

USER node

CMD ["node", "server.js"]
```

### Use pnpm

```dockerfile
FROM node:18-alpine

RUN npm install -g pnpm

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

COPY . .

USER node

CMD ["node", "server.js"]
```

### Application Logging to stdout

```javascript
// Ensure logs go to stdout for docker logs
console.log('Server starting...');
console.error('Error occurred');

// Or use logging library configured for stdout
const winston = require('winston');
const logger = winston.createLogger({
  transports: [new winston.transports.Console()]
});
```

### Graceful Shutdown

```javascript
// server.js
const server = app.listen(3000);

// Handle shutdown signals
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});
```

## Keep It Simple

Start with the simple production template. Only add complexity when you measure a specific problem:

1. **Simple** → Start here
2. **With Build** → Only if you need TypeScript/webpack
3. **Multi-Stage** → Only if image size is a problem (>500MB)
4. **Advanced** → Only for specific requirements

Most Node.js apps need just the simple template.
