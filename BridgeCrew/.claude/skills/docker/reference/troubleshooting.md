# Docker Troubleshooting Guide

## Container Won't Start

### Check Container Logs

```bash
# View logs
docker logs <container-id>

# Follow logs in real-time
docker logs -f <container-id>

# Last 100 lines
docker logs --tail 100 <container-id>

# With timestamps
docker logs -t <container-id>
```

### Check Container Status

```bash
# List all containers (including stopped)
docker ps -a

# Inspect container details
docker inspect <container-id>

# Check exit code
docker inspect <container-id> | jq '.[0].State.ExitCode'
```

### Common Exit Codes

- **0**: Success (clean exit)
- **1**: Application error
- **126**: Command cannot be executed (permission issue)
- **127**: Command not found
- **137**: Container killed (OOM or manual kill -9)
- **139**: Segmentation fault
- **143**: Graceful termination (SIGTERM)

### Container Starts Then Immediately Stops

**Check if CMD/ENTRYPOINT is running in foreground**:

```dockerfile
# BAD: Runs in background, container exits
CMD service nginx start

# GOOD: Runs in foreground
CMD ["nginx", "-g", "daemon off;"]
```

**Check for missing dependencies**:
```bash
# Run interactively to debug
docker run -it myapp sh

# Check if command exists
which node
node --version
```

## Build Issues

### Build Fails with "Cannot Find File"

**Check build context**:
```bash
# Files sent to Docker daemon
docker build .
```

**Fix**: Ensure file exists and isn't in .dockerignore

**Check COPY paths**:
```dockerfile
# Wrong: Tries to copy from outside context
COPY ../file.txt .

# Right: Copy from within context
COPY file.txt .
```

### Build Cache Issues

**Force rebuild without cache**:
```bash
docker build --no-cache -t myapp .
```

**Invalidate cache from specific layer**:
```dockerfile
# Add this to bust cache from this point
RUN echo "Cache bust: 2024-01-15"
```

### Permission Denied During Build

```bash
# ERROR: permission denied while trying to connect to Docker daemon

# Fix: Add user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Or fix socket permissions (temporary)
sudo chmod 666 /var/run/docker.sock
```

### Package Installation Fails

```dockerfile
# Alpine: Update index first
RUN apk update && apk add --no-cache curl

# Debian/Ubuntu: Update first
RUN apt-get update && apt-get install -y curl
```

## Network Issues

### Cannot Connect to Container

**Check port mapping**:
```bash
# View published ports
docker port <container-id>

# Correct port mapping
docker run -p 3000:3000 myapp  # host:container
```

**Check if service is listening**:
```bash
# Inside container
docker exec -it <container-id> sh
netstat -tlnp
# Or
ss -tlnp

# Should see 0.0.0.0:3000 (not 127.0.0.1:3000)
```

**Application must listen on 0.0.0.0, not localhost**:
```javascript
// BAD: Only accessible within container
app.listen(3000, 'localhost');

// GOOD: Accessible from host
app.listen(3000, '0.0.0.0');
```

### Container Cannot Reach Other Containers

**Check network**:
```bash
# List networks
docker network ls

# Inspect network
docker network inspect bridge

# Connect container to network
docker network connect mynetwork <container-id>
```

**Use container names as hostnames**:
```yaml
# docker-compose.yml
services:
  app:
    depends_on:
      - database
  database:
    image: postgres

# In app, connect to: postgresql://database:5432/mydb
```

### DNS Resolution Fails

**Check DNS settings**:
```bash
docker run --dns 8.8.8.8 myapp
```

**Or configure in daemon.json**:
```json
{
  "dns": ["8.8.8.8", "8.8.4.4"]
}
```

## Storage Issues

### No Space Left on Device

**Check disk usage**:
```bash
docker system df

# Example output:
# TYPE           TOTAL    ACTIVE   SIZE      RECLAIMABLE
# Images         15       5        2.5GB     1.2GB (48%)
# Containers     20       3        100MB     80MB (80%)
# Local Volumes  10       2        500MB     300MB (60%)
```

**Clean up**:
```bash
# Remove unused containers, networks, images
docker system prune

# Include volumes
docker system prune --volumes

# Remove all unused images (not just dangling)
docker system prune -a

# Remove specific resources
docker container prune  # Stopped containers
docker image prune      # Unused images
docker volume prune     # Unused volumes
```

### Volume Mount Issues

**Permission denied accessing volume**:
```bash
# Check ownership
docker exec <container-id> ls -la /path/to/volume

# Fix: Set correct ownership
docker run -v $(pwd)/data:/app/data --user $(id -u):$(id -g) myapp
```

**Changes in volume not reflected**:
```yaml
# Use absolute paths for volumes
services:
  app:
    volumes:
      - ./src:/app/src  # Relative (might cause issues)
      - /absolute/path/src:/app/src  # Better
```

### Named Volume Not Persisting

```bash
# Check if volume exists
docker volume ls

# Inspect volume
docker volume inspect myvolume

# Use named volume correctly
docker run -v myvolume:/app/data myapp
```

## Performance Issues

### Container Running Slow

**Check resource usage**:
```bash
# Real-time stats
docker stats

# Specific container
docker stats <container-id>
```

**Check resource limits**:
```bash
docker inspect <container-id> | jq '.[0].HostConfig.Memory'
docker inspect <container-id> | jq '.[0].HostConfig.CpuShares'
```

**Increase limits**:
```yaml
# docker-compose.yml
services:
  app:
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: '2.0'
```

### Build is Very Slow

**Optimize layer caching**:
```dockerfile
# Copy dependency files first (changes less often)
COPY package*.json ./
RUN npm install

# Then copy source (changes more often)
COPY . .
```

**Use .dockerignore**:
```
node_modules
.git
.env
*.log
coverage
.DS_Store
```

**Use BuildKit**:
```bash
# Enable BuildKit for faster builds
DOCKER_BUILDKIT=1 docker build -t myapp .
```

## Connection Issues

### Cannot Connect to Docker Daemon

```bash
# Error: Cannot connect to the Docker daemon at unix:///var/run/docker.sock

# Check if Docker is running
docker info

# Start Docker (macOS)
open -a Docker

# Start Docker (Linux)
sudo systemctl start docker

# Check socket permissions
ls -la /var/run/docker.sock
```

### Docker Daemon Not Starting

**Check logs**:
```bash
# macOS
cat ~/Library/Containers/com.docker.docker/Data/log/vm/dockerd.log

# Linux
journalctl -u docker.service
```

**Reset Docker** (last resort):
```bash
# macOS: Docker Desktop -> Troubleshoot -> Reset to factory defaults
# Linux:
sudo systemctl stop docker
sudo rm -rf /var/lib/docker
sudo systemctl start docker
```

## Image Issues

### Image Too Large

**Check image size**:
```bash
docker images myapp
```

**Reduce size**:

1. **Use smaller base image**:
   ```dockerfile
   FROM node:18-alpine  # Instead of node:18
   ```

2. **Multi-stage builds**:
   ```dockerfile
   FROM node:18-alpine AS builder
   COPY . .
   RUN npm run build

   FROM node:18-alpine
   COPY --from=builder /app/dist ./dist
   ```

3. **Clean up in same layer**:
   ```dockerfile
   RUN apt-get update && \
       apt-get install -y curl && \
       rm -rf /var/lib/apt/lists/*
   ```

4. **Remove dev dependencies**:
   ```dockerfile
   RUN npm ci --only=production
   ```

### Cannot Pull Image

**Authentication required**:
```bash
# Login to registry
docker login
docker login registry.example.com

# Pull with credentials
docker pull registry.example.com/myapp:latest
```

**Image not found**:
```bash
# Check exact image name and tag
docker search nginx

# Check registry
curl https://registry.hub.docker.com/v2/repositories/library/nginx/tags
```

### Dangling Images Piling Up

```bash
# Remove dangling images (untagged)
docker image prune

# Remove all unused images
docker image prune -a
```

## Debugging Techniques

### Get Shell Access to Running Container

```bash
# Bash
docker exec -it <container-id> bash

# Sh (for alpine)
docker exec -it <container-id> sh

# As specific user
docker exec -it --user root <container-id> sh
```

### Run Container with Shell for Debugging

```bash
# Override entrypoint
docker run -it --entrypoint sh myapp

# Or specify shell as command
docker run -it myapp sh
```

### Copy Files from Container

```bash
# Copy from container to host
docker cp <container-id>:/app/logs ./logs

# Copy from host to container
docker cp config.json <container-id>:/app/config.json
```

### View Processes in Container

```bash
# From host
docker top <container-id>

# Inside container
docker exec <container-id> ps aux
```

### Check Container IP Address

```bash
docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' <container-id>
```

## docker-compose Issues

### Service Dependencies Not Working

**Use depends_on with healthchecks**:
```yaml
services:
  app:
    depends_on:
      database:
        condition: service_healthy

  database:
    image: postgres
    healthcheck:
      test: ["CMD", "pg_isready"]
      interval: 5s
      timeout: 3s
      retries: 5
```

### Environment Variables Not Loading

**Check .env file location** (must be same directory as docker-compose.yml):
```bash
# Correct structure
project/
├── docker-compose.yml
└── .env
```

**Check env_file syntax**:
```yaml
services:
  app:
    env_file:
      - .env      # Correct
      - .env.local
```

**Verify variables are loaded**:
```bash
docker-compose config  # Shows resolved configuration
```

### Port Already in Use

```bash
# Error: port is already allocated

# Find what's using the port
lsof -i :3000
netstat -tulpn | grep 3000

# Kill the process
kill <pid>

# Or use different port
docker run -p 3001:3000 myapp
```

### Changes Not Reflected After Rebuild

```bash
# Force rebuild
docker-compose build --no-cache

# Recreate containers
docker-compose up --force-recreate

# Nuclear option: clean everything
docker-compose down -v
docker-compose build --no-cache
docker-compose up
```

## Common Error Messages

### "exec format error"

**Cause**: Architecture mismatch (building on ARM, running on x86 or vice versa)

**Fix**:
```bash
# Build for specific platform
docker build --platform linux/amd64 -t myapp .

# Or in Dockerfile
FROM --platform=linux/amd64 node:18-alpine
```

### "no space left on device"

See "No Space Left on Device" section above.

### "layer does not exist" or "failed to export image"

**Cause**: Corrupted image or build cache

**Fix**:
```bash
# Clean build cache
docker builder prune

# Remove all stopped containers and images
docker system prune -a
```

### "could not find an available, non-overlapping IPv4 address pool"

**Cause**: Too many Docker networks

**Fix**:
```bash
# Remove unused networks
docker network prune

# Or manually remove
docker network rm <network-id>
```

## Quick Diagnostic Commands

```bash
# System information
docker info
docker version

# What's running
docker ps

# What's using resources
docker stats

# Disk usage
docker system df

# Check specific container
docker inspect <container-id>
docker logs <container-id>
docker top <container-id>

# Network connectivity
docker exec <container-id> ping 8.8.8.8
docker exec <container-id> nslookup google.com

# File system
docker exec <container-id> df -h
docker exec <container-id> ls -la /app
```

## Getting Help

```bash
# Command help
docker --help
docker run --help

# Inspect what's happening
docker events  # Real-time events

# Check Docker daemon status
docker info
```

## Prevention Tips

1. **Always check logs first**: `docker logs <container-id>`
2. **Use health checks**: Know when containers are actually ready
3. **Set resource limits**: Prevent OOM kills
4. **Use .dockerignore**: Faster builds, smaller images
5. **Pin versions**: Reproducible builds
6. **Test locally first**: `docker run` before `docker-compose up`
7. **Monitor disk space**: `docker system df` regularly
8. **Clean up regularly**: `docker system prune` weekly
