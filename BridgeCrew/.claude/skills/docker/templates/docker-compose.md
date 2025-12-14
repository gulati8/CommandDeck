# docker-compose Templates

## Simple Web Application

**Location**: Place at project root

**File**: `docker-compose.yml`

```yaml
services:
  app:
    build: ./app
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
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

**Usage**:
```bash
docker-compose up          # Start all services
docker-compose up -d       # Start in background
docker-compose down        # Stop and remove containers
docker-compose logs -f app # View app logs
```

## Web App with Redis Cache

```yaml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - REDIS_URL=redis://cache:6379
      - DATABASE_URL=postgresql://postgres:password@database:5432/myapp
    depends_on:
      database:
        condition: service_healthy
      cache:
        condition: service_started

  database:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=myapp
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 3s
      retries: 5

  cache:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

## Frontend + Backend + Database

```yaml
services:
  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      - REACT_APP_API_URL=http://localhost:8000
    depends_on:
      - backend

  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://postgres:password@database:5432/myapp
      - SECRET_KEY=${SECRET_KEY}
    depends_on:
      database:
        condition: service_healthy
    volumes:
      - ./backend/uploads:/app/uploads

  database:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=myapp
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 3s
      retries: 5

volumes:
  postgres_data:
```

## Development with Hot-Reload

```yaml
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.dev
    ports:
      - "3000:3000"
    volumes:
      - ./src:/app/src              # Hot-reload source
      - /app/node_modules           # Don't overwrite modules
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

## Multiple Environments

**File**: `docker-compose.yml` (base)

```yaml
services:
  app:
    build: .
    environment:
      - NODE_ENV=${NODE_ENV:-production}
    depends_on:
      - database

  database:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=myapp
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

**File**: `docker-compose.dev.yml` (overrides)

```yaml
services:
  app:
    build:
      dockerfile: Dockerfile.dev
    ports:
      - "3000:3000"
    volumes:
      - ./src:/app/src
    environment:
      - NODE_ENV=development
```

**Usage**:
```bash
# Development
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up

# Production
docker-compose up
```

## Background Workers (Celery)

```yaml
services:
  web:
    build: .
    ports:
      - "8000:8000"
    environment:
      - CELERY_BROKER_URL=redis://redis:6379/0
      - DATABASE_URL=postgresql://postgres:password@database:5432/myapp
    depends_on:
      - database
      - redis

  worker:
    build: .
    command: celery -A tasks worker --loglevel=info
    environment:
      - CELERY_BROKER_URL=redis://redis:6379/0
      - DATABASE_URL=postgresql://postgres:password@database:5432/myapp
    depends_on:
      - redis
      - database

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

  database:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=myapp
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
  redis_data:
```

## Microservices Architecture

```yaml
services:
  api-gateway:
    build: ./services/gateway
    ports:
      - "8000:8000"
    environment:
      - USER_SERVICE_URL=http://user-service:8001
      - ORDER_SERVICE_URL=http://order-service:8002
    depends_on:
      - user-service
      - order-service

  user-service:
    build: ./services/users
    environment:
      - DATABASE_URL=postgresql://postgres:password@user-db:5432/users
    depends_on:
      - user-db

  order-service:
    build: ./services/orders
    environment:
      - DATABASE_URL=postgresql://postgres:password@order-db:5432/orders
      - RABBITMQ_URL=amqp://guest:guest@rabbitmq:5672
    depends_on:
      - order-db
      - rabbitmq

  user-db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=users
      - POSTGRES_PASSWORD=password
    volumes:
      - user_data:/var/lib/postgresql/data

  order-db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=orders
      - POSTGRES_PASSWORD=password
    volumes:
      - order_data:/var/lib/postgresql/data

  rabbitmq:
    image: rabbitmq:3-management-alpine
    ports:
      - "15672:15672"  # Management UI

volumes:
  user_data:
  order_data:
```

## With Environment File

**File**: `docker-compose.yml`

```yaml
services:
  app:
    build: .
    ports:
      - "${APP_PORT:-3000}:3000"
    env_file:
      - .env
    depends_on:
      - database

  database:
    image: postgres:15-alpine
    env_file:
      - .env
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

**File**: `.env`

```bash
# Application
NODE_ENV=development
APP_PORT=3000
SECRET_KEY=your-secret-key

# Database
POSTGRES_DB=myapp
POSTGRES_USER=postgres
POSTGRES_PASSWORD=password
DATABASE_URL=postgresql://postgres:password@database:5432/myapp
```

**File**: `.env.example` (commit to git)

```bash
# Application
NODE_ENV=development
APP_PORT=3000
SECRET_KEY=change-me

# Database
POSTGRES_DB=myapp
POSTGRES_USER=postgres
POSTGRES_PASSWORD=change-me
DATABASE_URL=postgresql://postgres:password@database:5432/myapp
```

## Resource Limits

```yaml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 256M

  database:
    image: postgres:15-alpine
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

## Custom Networks

```yaml
services:
  frontend:
    build: ./frontend
    networks:
      - frontend-network

  backend:
    build: ./backend
    networks:
      - frontend-network
      - backend-network
    depends_on:
      - database

  database:
    image: postgres:15-alpine
    networks:
      - backend-network
    volumes:
      - postgres_data:/var/lib/postgresql/data

networks:
  frontend-network:
  backend-network:

volumes:
  postgres_data:
```

## Health Checks

```yaml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:3000/health"]
      interval: 30s
      timeout: 3s
      retries: 3
      start_period: 10s
    depends_on:
      database:
        condition: service_healthy

  database:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=myapp
      - POSTGRES_PASSWORD=password
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 3s
      retries: 5
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

## Logging Configuration

```yaml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
    depends_on:
      - database

  database:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=myapp
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

volumes:
  postgres_data:
```

## Restart Policies

```yaml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    restart: unless-stopped  # Restart unless manually stopped
    depends_on:
      - database

  database:
    image: postgres:15-alpine
    restart: always  # Always restart
    volumes:
      - postgres_data:/var/lib/postgresql/data

  cache:
    image: redis:7-alpine
    restart: on-failure  # Restart only on failure

volumes:
  postgres_data:
```

## Best Practices Checklist

- [ ] Place docker-compose.yml at project root
- [ ] Use specific image tags (not `latest`)
- [ ] Define volumes for persistent data
- [ ] Use health checks for critical services
- [ ] Set resource limits
- [ ] Use environment variables for configuration
- [ ] Create .env.example for documentation
- [ ] Add restart policies
- [ ] Use depends_on with conditions
- [ ] Configure logging
- [ ] Name services clearly
- [ ] Use custom networks for isolation

## Common Commands

```bash
# Start services
docker-compose up
docker-compose up -d                    # Background
docker-compose up --build               # Rebuild first

# Stop services
docker-compose stop                     # Stop without removing
docker-compose down                     # Stop and remove
docker-compose down -v                  # Also remove volumes

# View status
docker-compose ps                       # Running services
docker-compose logs                     # All logs
docker-compose logs -f app              # Follow app logs
docker-compose logs --tail=100 app      # Last 100 lines

# Execute commands
docker-compose exec app sh              # Shell into service
docker-compose exec app npm test        # Run command

# Rebuild
docker-compose build                    # Build all
docker-compose build --no-cache app     # Rebuild specific service

# Scale services
docker-compose up -d --scale worker=3   # Run 3 workers

# Validate config
docker-compose config                   # View resolved config
```

## Keep It Simple

Start with a simple configuration:
1. **Single service + database** → Most apps start here
2. **Add cache if needed** → Redis, Memcached
3. **Add workers if needed** → Background jobs
4. **Custom networks** → Only for isolation requirements

Don't add complexity until you need it. A simple docker-compose.yml with 2-3 services is usually enough.
