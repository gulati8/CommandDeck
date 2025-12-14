# Go Dockerfile Templates

## Simple Production Dockerfile

**Location**: Place in your Go application root

**File**: `Dockerfile`

```dockerfile
FROM golang:1.21-alpine AS builder

WORKDIR /app

# Copy go mod files
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build binary
RUN CGO_ENABLED=0 GOOS=linux go build -o main .

# Production stage
FROM alpine:3.18

WORKDIR /app

# Copy binary from builder
COPY --from=builder /app/main .

# Create non-root user
RUN adduser -D -u 1000 appuser
USER appuser

EXPOSE 8080

CMD ["./main"]
```

**Usage**:
```bash
# Build
docker build -t myapp:latest .

# Run
docker run -p 8080:8080 myapp:latest
```

## Minimal Production (Scratch)

Smallest possible image using scratch base

**File**: `Dockerfile`

```dockerfile
FROM golang:1.21-alpine AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

# Build static binary
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o main .

# Production stage - scratch (empty base)
FROM scratch

WORKDIR /app

# Copy CA certificates for HTTPS
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/

# Copy binary
COPY --from=builder /app/main .

# Create /tmp directory (many apps need it)
COPY --from=builder --chown=65534:65534 /tmp /tmp

# Use nobody user (numeric UID works in scratch)
USER 65534

EXPOSE 8080

ENTRYPOINT ["./main"]
```

**Benefits**:
- Image size: ~10MB (vs ~100MB with alpine)
- Maximum security (no shell, no package manager)
- Only your binary

## Development Dockerfile

**File**: `Dockerfile.dev`

```dockerfile
FROM golang:1.21-alpine

WORKDIR /app

# Install air for hot-reload
RUN go install github.com/cosmtrek/air@latest

# Copy go mod files
COPY go.mod go.sum ./
RUN go mod download

EXPOSE 8080

# Source will be mounted as volume

# Run with hot-reload
CMD ["air"]
```

**With docker-compose.yml**:
```yaml
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.dev
    volumes:
      - .:/app
    ports:
      - "8080:8080"
    environment:
      - GO_ENV=development
```

**.air.toml** (hot-reload config):
```toml
[build]
  cmd = "go build -o ./tmp/main ."
  bin = "tmp/main"
  include_ext = ["go", "tmpl", "html"]
  exclude_dir = ["tmp", "vendor"]
```

## With CGO Dependencies

For apps using C libraries (SQLite, etc.)

**File**: `Dockerfile`

```dockerfile
FROM golang:1.21-alpine AS builder

# Install build dependencies
RUN apk add --no-cache gcc musl-dev sqlite-dev

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

# Build with CGO
RUN CGO_ENABLED=1 GOOS=linux go build -o main .

# Production stage
FROM alpine:3.18

# Install runtime dependencies
RUN apk add --no-cache sqlite-libs

WORKDIR /app

COPY --from=builder /app/main .

RUN adduser -D -u 1000 appuser
USER appuser

EXPOSE 8080

CMD ["./main"]
```

## Gin Web Framework

**File**: `Dockerfile`

```dockerfile
FROM golang:1.21-alpine AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

# Build with optimizations
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o main .

FROM alpine:3.18

RUN apk --no-cache add ca-certificates

WORKDIR /app

COPY --from=builder /app/main .

# Copy static files if any
# COPY --from=builder /app/static ./static
# COPY --from=builder /app/templates ./templates

RUN adduser -D -u 1000 appuser
USER appuser

EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

CMD ["./main"]
```

## gRPC Service

**File**: `Dockerfile`

```dockerfile
FROM golang:1.21-alpine AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -o main .

FROM alpine:3.18

RUN apk --no-cache add ca-certificates

WORKDIR /app

COPY --from=builder /app/main .

RUN adduser -D -u 1000 appuser
USER appuser

# gRPC port
EXPOSE 50051

CMD ["./main"]
```

## Multi-Binary Project

**File**: `Dockerfile`

```dockerfile
FROM golang:1.21-alpine AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

# Build multiple binaries
RUN CGO_ENABLED=0 GOOS=linux go build -o api ./cmd/api
RUN CGO_ENABLED=0 GOOS=linux go build -o worker ./cmd/worker

FROM alpine:3.18

RUN apk --no-cache add ca-certificates

WORKDIR /app

COPY --from=builder /app/api .
COPY --from=builder /app/worker .

RUN adduser -D -u 1000 appuser
USER appuser

# Default to API, override for worker
EXPOSE 8080

CMD ["./api"]
```

**docker-compose.yml**:
```yaml
services:
  api:
    build: .
    ports:
      - "8080:8080"
    command: ["./api"]

  worker:
    build: .
    command: ["./worker"]
```

## With Private Go Modules

**File**: `Dockerfile`

```dockerfile
FROM golang:1.21-alpine AS builder

WORKDIR /app

# Configure git for private repos
RUN apk add --no-cache git
ARG GITHUB_TOKEN
RUN git config --global url."https://${GITHUB_TOKEN}@github.com/".insteadOf "https://github.com/"

# Or use SSH
# RUN mkdir -p /root/.ssh && \
#     echo "${SSH_KEY}" > /root/.ssh/id_rsa && \
#     chmod 600 /root/.ssh/id_rsa

ENV GOPRIVATE=github.com/yourorg/*

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -o main .

FROM alpine:3.18

RUN apk --no-cache add ca-certificates

WORKDIR /app

COPY --from=builder /app/main .

RUN adduser -D -u 1000 appuser
USER appuser

EXPOSE 8080

CMD ["./main"]
```

**Build**:
```bash
docker build --build-arg GITHUB_TOKEN=$GITHUB_TOKEN -t myapp .
```

## Optimized Build with Cache

Uses Docker BuildKit cache mounts

**File**: `Dockerfile`

```dockerfile
# syntax=docker/dockerfile:1

FROM golang:1.21-alpine AS builder

WORKDIR /app

# Cache go modules
COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod \
    go mod download

COPY . .

# Cache build
RUN --mount=type=cache,target=/root/.cache/go-build \
    --mount=type=cache,target=/go/pkg/mod \
    CGO_ENABLED=0 GOOS=linux go build -o main .

FROM alpine:3.18

RUN apk --no-cache add ca-certificates

WORKDIR /app

COPY --from=builder /app/main .

RUN adduser -D -u 1000 appuser
USER appuser

EXPOSE 8080

CMD ["./main"]
```

**Build with BuildKit**:
```bash
DOCKER_BUILDKIT=1 docker build -t myapp .
```

## With Vendored Dependencies

**File**: `Dockerfile`

```dockerfile
FROM golang:1.21-alpine AS builder

WORKDIR /app

# Copy vendored dependencies
COPY vendor ./vendor
COPY go.mod go.sum ./

COPY . .

# Build using vendor
RUN CGO_ENABLED=0 GOOS=linux go build -mod=vendor -o main .

FROM alpine:3.18

RUN apk --no-cache add ca-certificates

WORKDIR /app

COPY --from=builder /app/main .

RUN adduser -D -u 1000 appuser
USER appuser

EXPOSE 8080

CMD ["./main"]
```

## Debugging with Delve

**File**: `Dockerfile.debug`

```dockerfile
FROM golang:1.21-alpine

# Install delve debugger
RUN go install github.com/go-delve/delve/cmd/dlv@latest

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

# Build with debug symbols
RUN go build -gcflags="all=-N -l" -o main .

EXPOSE 8080 40000

# Start with delve
CMD ["dlv", "--listen=:40000", "--headless=true", "--api-version=2", "--accept-multiclient", "exec", "./main"]
```

## With Configuration Files

**File**: `Dockerfile`

```dockerfile
FROM golang:1.21-alpine AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -o main .

FROM alpine:3.18

RUN apk --no-cache add ca-certificates

WORKDIR /app

COPY --from=builder /app/main .

# Copy config files
COPY config/production.yaml ./config/

RUN adduser -D -u 1000 appuser && \
    chown -R appuser:appuser /app
USER appuser

EXPOSE 8080

# Use environment variable to select config
ENV CONFIG_FILE=/app/config/production.yaml

CMD ["./main"]
```

## Best Practices Checklist

When creating Go Dockerfile:

- [ ] Use multi-stage build (golang:alpine → alpine or scratch)
- [ ] Pin specific Go version (e.g., `golang:1.21-alpine`)
- [ ] Copy `go.mod` and `go.sum` before source code
- [ ] Set `CGO_ENABLED=0` for static binaries
- [ ] Use build flags `-ldflags="-s -w"` to reduce size
- [ ] Copy CA certificates when using scratch
- [ ] Run as non-root user
- [ ] Use `WORKDIR /app`
- [ ] Document ports with `EXPOSE`
- [ ] Include health check for web services
- [ ] Create `.dockerignore` file
- [ ] Consider using scratch for smallest image

## Common Patterns

### Build Tags

```dockerfile
RUN CGO_ENABLED=0 GOOS=linux go build -tags=production -o main .
```

### Version Information

```dockerfile
ARG VERSION=dev
RUN CGO_ENABLED=0 GOOS=linux go build \
    -ldflags="-X main.Version=${VERSION}" \
    -o main .
```

**In Go code**:
```go
var Version string

func main() {
    log.Printf("Starting app version %s", Version)
}
```

### Application Logging

```go
import (
    "log"
    "os"
)

func main() {
    // Log to stdout for docker logs
    log.SetOutput(os.Stdout)
    log.Println("Starting server...")
}
```

### Graceful Shutdown

```go
import (
    "context"
    "net/http"
    "os"
    "os/signal"
    "time"
)

func main() {
    srv := &http.Server{Addr: ":8080"}

    go func() {
        srv.ListenAndServe()
    }()

    // Wait for interrupt signal
    quit := make(chan os.Signal, 1)
    signal.Notify(quit, os.Interrupt)
    <-quit

    // Graceful shutdown with timeout
    ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer cancel()
    srv.Shutdown(ctx)
}
```

## Keep It Simple

Start with the multi-stage alpine template. Only use scratch if:
- You don't need shell access for debugging
- Your app doesn't need timezone data or CA certs (or you copy them)
- Image size is critical (<20MB vs ~100MB matters)

Most Go apps work great with the alpine-based multi-stage build.
