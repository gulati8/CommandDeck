# Docker Logging Patterns

## The Core Principle

**Containers should log to stdout/stderr, not files**

Docker captures stdout/stderr automatically, making logs accessible via `docker logs`. Writing to files makes logs hard to access and wastes disk space.

## Why stdout/stderr?

**Benefits**:
- `docker logs <container>` just works
- No disk space issues (logs rotate automatically)
- Centralized logging systems capture easily
- Works with orchestrators (Kubernetes, Swarm)
- No special configuration needed

**Problems with file logging**:
- Need to mount volumes for log files
- Logs fill up disk
- Hard to access without exec into container
- Need rotation configuration

## Basic Logging Pattern

### Node.js

**Log to stdout**:
```javascript
// server.js
console.log('Server starting...');
console.error('Error occurred:', error);

// Or use logging library
const winston = require('winston');

const logger = winston.createLogger({
  format: winston.format.json(),
  transports: [
    new winston.transports.Console()  // stdout
  ]
});

logger.info('Server started', { port: 3000 });
logger.error('Database error', { error: error.message });
```

**Dockerfile**:
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

# Ensure logs go to stdout (this is default in Docker)
ENV NODE_ENV=production

USER node

CMD ["node", "server.js"]
```

**View logs**:
```bash
docker logs mycontainer
docker logs -f mycontainer              # Follow
docker logs --tail 100 mycontainer      # Last 100 lines
docker logs --since 10m mycontainer     # Last 10 minutes
```

### Python

**Log to stdout**:
```python
import logging
import sys

# Configure logging to stdout
logging.basicConfig(
    stream=sys.stdout,
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)

logger.info('Server starting')
logger.error('Database connection failed', exc_info=True)
```

**Structured logging (JSON)**:
```python
import logging
import json
import sys

class JsonFormatter(logging.Formatter):
    def format(self, record):
        log_data = {
            'timestamp': self.formatTime(record),
            'level': record.levelname,
            'message': record.getMessage(),
            'logger': record.name,
        }
        if record.exc_info:
            log_data['exception'] = self.formatException(record.exc_info)
        return json.dumps(log_data)

handler = logging.StreamHandler(sys.stdout)
handler.setFormatter(JsonFormatter())
logger = logging.getLogger()
logger.addHandler(handler)
logger.setLevel(logging.INFO)

logger.info('Server started', extra={'port': 8000})
```

### Go

**Log to stdout**:
```go
package main

import (
    "log"
    "os"
)

func main() {
    // Default log goes to stderr
    log.Println("Server starting")

    // Or explicitly to stdout
    logger := log.New(os.Stdout, "", log.LstdFlags)
    logger.Println("Server starting on port 8080")
}
```

**Structured logging (JSON)**:
```go
import (
    "encoding/json"
    "log"
    "os"
)

type LogEntry struct {
    Level   string `json:"level"`
    Message string `json:"message"`
    Service string `json:"service"`
}

func logJSON(level, message string) {
    entry := LogEntry{
        Level:   level,
        Message: message,
        Service: "api",
    }
    json.NewEncoder(os.Stdout).Encode(entry)
}

func main() {
    logJSON("info", "Server starting")
}
```

## Structured Logging (JSON)

### Why JSON?

**Benefits**:
- Easy to parse by log aggregators
- Consistent format
- Include metadata (request ID, user ID, etc.)
- Filter and search by fields

### Node.js with Winston

```javascript
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

// Usage
logger.info('User logged in', {
  userId: 123,
  ip: '192.168.1.1',
  requestId: 'abc-123'
});

logger.error('Database query failed', {
  query: 'SELECT * FROM users',
  error: error.message,
  requestId: 'abc-123'
});
```

**Output**:
```json
{"level":"info","message":"User logged in","timestamp":"2024-01-15T10:30:00.000Z","userId":123,"ip":"192.168.1.1","requestId":"abc-123"}
{"level":"error","message":"Database query failed","timestamp":"2024-01-15T10:30:01.000Z","query":"SELECT * FROM users","error":"Connection timeout","requestId":"abc-123"}
```

### Python with structlog

```python
import structlog

structlog.configure(
    processors=[
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer()
    ],
    logger_factory=structlog.PrintLoggerFactory(),
)

logger = structlog.get_logger()

logger.info("user_logged_in", user_id=123, ip="192.168.1.1")
logger.error("database_query_failed", query="SELECT * FROM users", error="Connection timeout")
```

## Log Levels

### Standard Levels

```javascript
logger.debug('Detailed info for debugging');     // Development only
logger.info('General information');              // Normal operation
logger.warn('Warning - something unexpected');   // Potential issue
logger.error('Error - something failed');        // Error occurred
logger.fatal('Fatal - system unusable');         // Critical failure
```

### Environment-Based Levels

**Dockerfile**:
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

# Default to info in production
ENV LOG_LEVEL=info

USER node

CMD ["node", "server.js"]
```

**Application**:
```javascript
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  transports: [new winston.transports.Console()]
});
```

**Usage**:
```bash
# Development - verbose logging
docker run -e LOG_LEVEL=debug myapp

# Production - less noise
docker run -e LOG_LEVEL=info myapp
```

## Request Logging

### Express Middleware

```javascript
const express = require('express');
const { v4: uuidv4 } = require('uuid');

const app = express();

// Add request ID to each request
app.use((req, res, next) => {
  req.id = uuidv4();
  req.startTime = Date.now();
  next();
});

// Log all requests
app.use((req, res, next) => {
  res.on('finish', () => {
    const duration = Date.now() - req.startTime;
    logger.info('request', {
      requestId: req.id,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      userAgent: req.get('user-agent'),
      ip: req.ip
    });
  });
  next();
});
```

**Output**:
```json
{"level":"info","message":"request","requestId":"abc-123","method":"GET","path":"/api/users","statusCode":200,"duration":45,"userAgent":"Mozilla/5.0...","ip":"192.168.1.1"}
```

### Python/Flask

```python
from flask import Flask, request, g
import time
import uuid

app = Flask(__name__)

@app.before_request
def before_request():
    g.request_id = str(uuid.uuid4())
    g.start_time = time.time()

@app.after_request
def after_request(response):
    duration = (time.time() - g.start_time) * 1000
    logger.info('request', extra={
        'request_id': g.request_id,
        'method': request.method,
        'path': request.path,
        'status_code': response.status_code,
        'duration': duration,
        'ip': request.remote_addr
    })
    return response
```

## Log Rotation

Docker automatically rotates logs with json-file driver

### Configure in docker-compose.yml

```yaml
services:
  app:
    build: .
    logging:
      driver: "json-file"
      options:
        max-size: "10m"     # Max 10MB per file
        max-file: "3"       # Keep 3 files
```

**Result**: Max 30MB of logs per container (10MB × 3 files)

### Configure in /etc/docker/daemon.json (Global)

```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
```

## Centralized Logging

### Forward Logs to External System

**Using Fluentd**:

```yaml
# docker-compose.yml
services:
  app:
    build: .
    logging:
      driver: "fluentd"
      options:
        fluentd-address: "localhost:24224"
        tag: "myapp"

  fluentd:
    image: fluent/fluentd:v1.14-1
    ports:
      - "24224:24224"
    volumes:
      - ./fluentd/fluent.conf:/fluentd/etc/fluent.conf
```

**Using syslog**:

```yaml
services:
  app:
    build: .
    logging:
      driver: "syslog"
      options:
        syslog-address: "tcp://192.168.1.100:514"
        tag: "myapp"
```

**Using AWS CloudWatch**:

```yaml
services:
  app:
    build: .
    logging:
      driver: "awslogs"
      options:
        awslogs-region: "us-east-1"
        awslogs-group: "myapp"
        awslogs-stream: "container"
```

## Don't Log Sensitive Data

### ❌ Bad

```javascript
logger.info('User login', {
  username: 'john',
  password: 'secret123',        // Don't log passwords!
  creditCard: '4111111111111111' // Don't log PII!
});

logger.error('API request failed', {
  apiKey: 'sk_live_12345',      // Don't log secrets!
  token: 'Bearer eyJ...'        // Don't log tokens!
});
```

### ✅ Good

```javascript
logger.info('User login', {
  username: 'john',
  // password excluded
});

logger.error('API request failed', {
  // API key excluded
  statusCode: 403
});

// Or redact sensitive fields
function redactSensitive(obj) {
  const redacted = { ...obj };
  const sensitiveFields = ['password', 'token', 'apiKey', 'creditCard'];

  sensitiveFields.forEach(field => {
    if (redacted[field]) {
      redacted[field] = '***REDACTED***';
    }
  });

  return redacted;
}

logger.info('User data', redactSensitive(userData));
```

## Logging Best Practices

1. **Always log to stdout/stderr**: Never to files
2. **Use structured logging**: JSON format for production
3. **Include context**: Request ID, user ID, timestamp
4. **Set appropriate levels**: DEBUG for dev, INFO for prod
5. **Configure rotation**: Prevent disk space issues
6. **Don't log secrets**: Passwords, tokens, API keys
7. **Log errors with stack traces**: Help debugging
8. **Use correlation IDs**: Track requests across services
9. **Keep logs searchable**: Consistent field names
10. **Monitor log volume**: High volume can indicate issues

## Debugging Logs

### View container logs

```bash
# All logs
docker logs mycontainer

# Follow (tail -f)
docker logs -f mycontainer

# Last N lines
docker logs --tail 100 mycontainer

# Since time
docker logs --since 2024-01-15T10:00:00 mycontainer
docker logs --since 10m mycontainer

# Timestamps
docker logs -t mycontainer

# Until time
docker logs --until 2024-01-15T11:00:00 mycontainer
```

### docker-compose logs

```bash
# All services
docker-compose logs

# Specific service
docker-compose logs app

# Follow
docker-compose logs -f app

# Last N lines
docker-compose logs --tail=100 app

# Timestamps
docker-compose logs -t app
```

## Production Logging Setup

### Complete Example

**Dockerfile**:
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

# Configure logging
ENV NODE_ENV=production \
    LOG_LEVEL=info

USER node

CMD ["node", "server.js"]
```

**server.js**:
```javascript
const express = require('express');
const winston = require('winston');
const { v4: uuidv4 } = require('uuid');

// Configure structured logging
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

const app = express();

// Request ID middleware
app.use((req, res, next) => {
  req.id = uuidv4();
  next();
});

// Request logging
app.use((req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    logger.info('request', {
      requestId: req.id,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: Date.now() - start,
      ip: req.ip
    });
  });

  next();
});

// Routes
app.get('/', (req, res) => {
  logger.info('Home page accessed', { requestId: req.id });
  res.send('Hello World');
});

// Error handling
app.use((err, req, res, next) => {
  logger.error('Unhandled error', {
    requestId: req.id,
    error: err.message,
    stack: err.stack
  });
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info('Server started', { port: PORT });
});
```

**docker-compose.yml**:
```yaml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - LOG_LEVEL=info
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

## Keep It Simple

Start with:
1. **Log to stdout** (console.log, console.error)
2. **Add structure** when you have many services (JSON)
3. **Add correlation IDs** when debugging becomes hard
4. **Configure rotation** when logs grow large
5. **Forward to centralized system** when managing many containers

Don't add complexity until you need it. Simple stdout logging works for most apps.
