# Docker Commands Cheat Sheet

## Image Operations

### Building Images
```bash
# Build image from Dockerfile in current directory
docker build -t myapp:latest .

# Build from specific Dockerfile
docker build -f Dockerfile.prod -t myapp:prod .

# Build with build args
docker build --build-arg NODE_ENV=production -t myapp .

# Build without cache
docker build --no-cache -t myapp .
```

### Managing Images
```bash
# List images
docker images
docker image ls

# Remove image
docker rmi myapp:latest
docker image rm myapp:latest

# Remove all unused images
docker image prune

# Tag image
docker tag myapp:latest myapp:v1.0.0

# Push to registry
docker push registry.example.com/myapp:v1.0.0

# Pull from registry
docker pull nginx:alpine

# Inspect image
docker inspect myapp:latest

# View image history/layers
docker history myapp:latest
```

## Container Operations

### Running Containers
```bash
# Run container
docker run myapp:latest

# Run in background (detached)
docker run -d myapp:latest

# Run with port mapping
docker run -p 3000:3000 myapp

# Run with environment variables
docker run -e NODE_ENV=production -e PORT=3000 myapp

# Run with env file
docker run --env-file .env myapp

# Run with volume mount
docker run -v $(pwd)/src:/app/src myapp

# Run with name
docker run --name my-container myapp

# Run with automatic restart
docker run --restart=unless-stopped myapp

# Run and remove after exit
docker run --rm myapp

# Run with interactive terminal
docker run -it myapp sh

# Complete example
docker run -d \
  --name myapp \
  -p 3000:3000 \
  -e NODE_ENV=production \
  --env-file .env \
  -v $(pwd)/data:/app/data \
  --restart=unless-stopped \
  myapp:latest
```

### Managing Running Containers
```bash
# List running containers
docker ps

# List all containers (including stopped)
docker ps -a

# Stop container
docker stop <container-id>
docker stop my-container

# Start stopped container
docker start <container-id>

# Restart container
docker restart <container-id>

# Remove container
docker rm <container-id>

# Force remove running container
docker rm -f <container-id>

# Stop all running containers
docker stop $(docker ps -q)

# Remove all stopped containers
docker container prune
```

### Inspecting Containers
```bash
# View logs
docker logs <container-id>

# Follow logs (like tail -f)
docker logs -f <container-id>

# Last 100 lines
docker logs --tail 100 <container-id>

# Logs with timestamps
docker logs -t <container-id>

# Inspect container details
docker inspect <container-id>

# View container stats (CPU, memory, etc.)
docker stats
docker stats <container-id>

# View processes in container
docker top <container-id>

# View port mappings
docker port <container-id>
```

### Executing in Running Containers
```bash
# Execute command in running container
docker exec <container-id> ls /app

# Interactive shell
docker exec -it <container-id> sh
docker exec -it <container-id> bash

# Execute as specific user
docker exec -u node <container-id> whoami

# Execute with environment variable
docker exec -e DEBUG=true <container-id> npm test
```

### Copying Files
```bash
# Copy from container to host
docker cp <container-id>:/app/logs ./logs

# Copy from host to container
docker cp ./config.json <container-id>:/app/config.json
```

## docker-compose Operations

### Basic Commands
```bash
# Start all services (build if needed)
docker-compose up

# Start in background
docker-compose up -d

# Start specific service
docker-compose up app

# Stop all services
docker-compose stop

# Stop and remove containers
docker-compose down

# Stop, remove containers, and remove volumes
docker-compose down -v

# View logs
docker-compose logs

# Follow logs
docker-compose logs -f

# Logs for specific service
docker-compose logs -f app

# List services
docker-compose ps

# Execute command in service
docker-compose exec app sh
```

### Building and Rebuilding
```bash
# Build/rebuild services
docker-compose build

# Build without cache
docker-compose build --no-cache

# Build specific service
docker-compose build app

# Up with force rebuild
docker-compose up --build
```

### Scaling Services
```bash
# Scale service to multiple instances
docker-compose up -d --scale app=3
```

## Network Operations

```bash
# List networks
docker network ls

# Create network
docker network create mynetwork

# Inspect network
docker network inspect mynetwork

# Remove network
docker network rm mynetwork

# Connect container to network
docker network connect mynetwork <container-id>

# Run container on specific network
docker run --network=mynetwork myapp
```

## Volume Operations

```bash
# List volumes
docker volume ls

# Create volume
docker volume create myvolume

# Inspect volume
docker volume inspect myvolume

# Remove volume
docker volume rm myvolume

# Remove all unused volumes
docker volume prune

# Run with named volume
docker run -v myvolume:/app/data myapp
```

## System Operations

### Cleanup
```bash
# Remove all unused data (containers, networks, images, cache)
docker system prune

# Include volumes in cleanup
docker system prune --volumes

# Remove everything (use with caution!)
docker system prune -a

# View disk usage
docker system df
```

### Information
```bash
# Docker version
docker version

# System-wide information
docker info

# List Docker disk usage
docker system df
```

## Registry Operations

```bash
# Login to registry
docker login
docker login registry.example.com

# Logout
docker logout

# Search Docker Hub
docker search nginx
```

## Common Workflows

### Development Workflow
```bash
# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Execute commands
docker-compose exec app npm test

# Stop services
docker-compose down
```

### Build and Deploy
```bash
# Build production image
docker build -t myapp:v1.0.0 .

# Test locally
docker run -p 3000:3000 myapp:v1.0.0

# Tag for registry
docker tag myapp:v1.0.0 registry.example.com/myapp:v1.0.0

# Push to registry
docker push registry.example.com/myapp:v1.0.0
```

### Debugging
```bash
# Get shell in running container
docker exec -it <container-id> sh

# View recent logs
docker logs --tail 50 <container-id>

# Follow logs
docker logs -f <container-id>

# Inspect container config
docker inspect <container-id>

# Check container stats
docker stats <container-id>
```

### Quick Tips

#### Get container ID by name
```bash
docker ps -qf "name=myapp"
```

#### Remove all stopped containers
```bash
docker rm $(docker ps -aq -f status=exited)
```

#### Stop and remove all containers
```bash
docker stop $(docker ps -aq) && docker rm $(docker ps -aq)
```

#### Remove dangling images
```bash
docker rmi $(docker images -f "dangling=true" -q)
```

#### View container IP address
```bash
docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' <container-id>
```
