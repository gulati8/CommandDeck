# Health Check Patterns

Health checks tell Docker (and orchestrators like Kubernetes) whether a container is working properly.

## Why Health Checks?

**Without health check**: Container is "running" even if app crashed or frozen
**With health check**: Orchestrator knows container is unhealthy and can restart it

**Benefits**:
- Automatic container restart on failure
- Load balancers route traffic only to healthy containers
- Rolling deploys wait for health before proceeding
- Monitoring knows actual app state

## Basic Health Check

### Dockerfile HEALTHCHECK

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

USER node

EXPOSE 3000

# Health check - every 30s, timeout 3s, 3 retries
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD node healthcheck.js || exit 1

CMD ["node", "server.js"]
```

### healthcheck.js

```javascript
const http = require('http');

const options = {
  host: 'localhost',
  port: 3000,
  path: '/health',
  timeout: 2000
};

const req = http.request(options, (res) => {
  // 200 = healthy, anything else = unhealthy
  process.exit(res.statusCode === 200 ? 0 : 1);
});

req.on('error', () => {
  process.exit(1);
});

req.end();
```

### server.js - Health Endpoint

```javascript
const express = require('express');
const app = express();

// Health check endpoint
app.get('/health', (req, res) => {
  // Check dependencies
  const healthy = checkDatabase() && checkRedis();

  if (healthy) {
    res.status(200).json({ status: 'ok' });
  } else {
    res.status(503).json({ status: 'unhealthy' });
  }
});

app.listen(3000);
```

## HTTP Health Check

### Using curl

```dockerfile
FROM node:18-alpine

# Install curl
RUN apk add --no-cache curl

WORKDIR /app
COPY . .

HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["node", "server.js"]
```

### Using wget

```dockerfile
FROM node:18-alpine

# wget is included in alpine
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "server.js"]
```

### Problem: Adds ~5MB for curl

**Better**: Write simple health check script without dependencies

## Python Health Check

### Flask

**Dockerfile**:
```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD python healthcheck.py || exit 1

USER appuser

CMD ["gunicorn", "--bind", "0.0.0.0:8000", "app:app"]
```

**healthcheck.py**:
```python
import requests
import sys

try:
    response = requests.get('http://localhost:8000/health', timeout=2)
    if response.status_code == 200:
        sys.exit(0)
    else:
        sys.exit(1)
except Exception:
    sys.exit(1)
```

**app.py**:
```python
from flask import Flask, jsonify

app = Flask(__name__)

@app.route('/health')
def health():
    # Check database connection
    try:
        db.session.execute('SELECT 1')
        return jsonify({'status': 'ok'}), 200
    except Exception:
        return jsonify({'status': 'unhealthy'}), 503
```

### Django

**healthcheck.py**:
```python
import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'myproject.settings')
django.setup()

from django.db import connection

try:
    # Check database
    connection.ensure_connection()
    sys.exit(0)
except Exception:
    sys.exit(1)
```

## Go Health Check

### Using curl/wget (Simple)

```dockerfile
FROM alpine:3.18

RUN apk --no-cache add ca-certificates

WORKDIR /app

COPY main .

HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget --spider -q http://localhost:8080/health || exit 1

USER appuser

CMD ["./main"]
```

### Using Custom Binary (Better)

**main.go**:
```go
package main

import (
    "net/http"
    "log"
)

func healthHandler(w http.ResponseWriter, r *http.Request) {
    // Check dependencies
    if !checkDatabase() {
        w.WriteHeader(http.StatusServiceUnavailable)
        w.Write([]byte(`{"status":"unhealthy"}`))
        return
    }

    w.WriteHeader(http.StatusOK)
    w.Write([]byte(`{"status":"ok"}`))
}

func main() {
    http.HandleFunc("/health", healthHandler)
    log.Fatal(http.ListenAndServe(":8080", nil))
}
```

**healthcheck.go** (separate binary):
```go
package main

import (
    "net/http"
    "os"
    "time"
)

func main() {
    client := http.Client{
        Timeout: 2 * time.Second,
    }

    resp, err := client.Get("http://localhost:8080/health")
    if err != nil || resp.StatusCode != 200 {
        os.Exit(1)
    }
    os.Exit(0)
}
```

**Dockerfile**:
```dockerfile
FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY . .
RUN CGO_ENABLED=0 go build -o main main.go
RUN CGO_ENABLED=0 go build -o healthcheck healthcheck.go

FROM alpine:3.18
RUN apk --no-cache add ca-certificates
WORKDIR /app
COPY --from=builder /app/main .
COPY --from=builder /app/healthcheck .

HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD /app/healthcheck || exit 1

USER appuser
CMD ["./main"]
```

## docker-compose Health Checks

```yaml
services:
  app:
    build: .
    depends_on:
      database:
        condition: service_healthy
      cache:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:3000/health"]
      interval: 30s
      timeout: 3s
      retries: 3
      start_period: 10s

  database:
    image: postgres:15-alpine
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 3s
      retries: 5

  cache:
    image: redis:7-alpine
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5
```

## Health Check Parameters

```dockerfile
HEALTHCHECK \
  --interval=30s \      # Run every 30 seconds
  --timeout=3s \        # Command must complete in 3 seconds
  --retries=3 \         # Mark unhealthy after 3 failures
  --start-period=40s \  # Grace period during startup
  CMD healthcheck.sh
```

**Defaults**:
- interval: 30s
- timeout: 30s
- retries: 3
- start-period: 0s

## Health Check Types

### 1. Basic Availability

Just check if app responds

```javascript
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});
```

### 2. Dependency Checks

Check database, cache, external services

```javascript
app.get('/health', async (req, res) => {
  const checks = {
    database: await checkDatabase(),
    redis: await checkRedis(),
    api: await checkExternalAPI()
  };

  const healthy = Object.values(checks).every(x => x === true);

  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'unhealthy',
    checks
  });
});
```

### 3. Detailed Health

Provide diagnostic information

```javascript
app.get('/health', async (req, res) => {
  const dbLatency = await measureDatabaseLatency();
  const memoryUsage = process.memoryUsage();
  const uptime = process.uptime();

  const healthy = dbLatency < 100; // ms

  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'unhealthy',
    timestamp: new Date().toISOString(),
    uptime,
    checks: {
      database: {
        status: healthy ? 'ok' : 'slow',
        latency: dbLatency
      }
    },
    memory: {
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024)
    }
  });
});
```

## Readiness vs Liveness

### Liveness Probe
"Is the container alive?"
- Fails → Restart container
- Check: Can process HTTP requests?

```dockerfile
HEALTHCHECK CMD curl -f http://localhost:3000/health || exit 1
```

### Readiness Probe (Kubernetes)
"Is the container ready to serve traffic?"
- Fails → Remove from load balancer
- Check: Are dependencies available?

**In Kubernetes**:
```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 3000
  initialDelaySeconds: 30
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /ready
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 5
```

**Application**:
```javascript
let isReady = false;

// Ready endpoint - checks dependencies
app.get('/ready', async (req, res) => {
  if (!isReady) {
    return res.status(503).json({ status: 'not ready' });
  }

  const dbOk = await checkDatabase();
  res.status(dbOk ? 200 : 503).json({
    status: dbOk ? 'ready' : 'not ready'
  });
});

// Health endpoint - basic alive check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Initialize
async function init() {
  await connectDatabase();
  await loadConfig();
  isReady = true;
}

init();
```

## Common Database Checks

### PostgreSQL

```bash
pg_isready -U postgres
```

```javascript
const { Pool } = require('pg');
const pool = new Pool();

async function checkDatabase() {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch (error) {
    return false;
  }
}
```

### MySQL

```bash
mysqladmin ping -h localhost
```

### MongoDB

```bash
mongo --eval "db.adminCommand('ping')"
```

### Redis

```bash
redis-cli ping
```

```javascript
const redis = require('redis');
const client = redis.createClient();

async function checkRedis() {
  try {
    await client.ping();
    return true;
  } catch (error) {
    return false;
  }
}
```

## Monitoring Health Status

### Check container health

```bash
# View health status
docker ps

# Inspect detailed health
docker inspect --format='{{json .State.Health}}' <container-id> | jq

# View health check logs
docker inspect <container-id> | jq '.[0].State.Health.Log'
```

### docker-compose

```bash
# View service health
docker-compose ps

# Check specific service
docker-compose exec app wget -O- http://localhost:3000/health
```

## Best Practices

1. **Keep it fast**: Health checks run frequently, should be <1s
2. **Check critical dependencies**: Database, cache, required services
3. **Don't check external APIs**: They can fail independently
4. **Return 200 for healthy, 503 for unhealthy**: Standard HTTP codes
5. **Use start-period**: Give app time to start up
6. **Log health check failures**: Help diagnose issues
7. **Include timestamp**: Know when check ran
8. **Don't be too strict**: Temporary glitches shouldn't fail health check

## Anti-Patterns

### ❌ Too Strict

```javascript
// BAD: Fails if ANY dependency has minor issue
app.get('/health', async (req, res) => {
  const dbLatency = await measureDb();
  if (dbLatency > 10) {  // Too strict!
    return res.status(503).send('DB slow');
  }
  res.send('OK');
});
```

### ❌ No Timeout

```javascript
// BAD: Could hang indefinitely
app.get('/health', async (req, res) => {
  await checkDatabase(); // No timeout!
  res.send('OK');
});
```

### ❌ Heavy Check

```javascript
// BAD: Too expensive to run every 30s
app.get('/health', async (req, res) => {
  await runAllMigrations();
  await rebuildCache();
  await scanAllRecords();
  res.send('OK');
});
```

## Keep It Simple

Start with basic HTTP check:

```dockerfile
HEALTHCHECK CMD wget --spider -q http://localhost:3000/health || exit 1
```

```javascript
app.get('/health', (req, res) => {
  res.send('OK');
});
```

Add dependency checks only when needed. Most apps just need to know if the web server is responding.
