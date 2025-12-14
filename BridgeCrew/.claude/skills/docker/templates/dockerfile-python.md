# Python Dockerfile Templates

## Simple Production Dockerfile

**Location**: Place in your Python application root

**File**: `Dockerfile`

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Copy requirements first (better caching)
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create non-root user
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

# Document the port
EXPOSE 8000

# Start the application
CMD ["python", "app.py"]
```

**Usage**:
```bash
# Build
docker build -t myapp:latest .

# Run
docker run -p 8000:8000 myapp:latest
```

## Development Dockerfile

**File**: `Dockerfile.dev`

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install dev dependencies
COPY requirements.txt requirements-dev.txt ./
RUN pip install --no-cache-dir -r requirements.txt -r requirements-dev.txt

# Source will be mounted as volume

EXPOSE 8000

# Run with hot-reload
CMD ["python", "-m", "flask", "run", "--host=0.0.0.0", "--reload"]
```

**With docker-compose.yml**:
```yaml
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.dev
    volumes:
      - ./src:/app/src
    ports:
      - "8000:8000"
    environment:
      - FLASK_ENV=development
```

## Flask Application

**File**: `Dockerfile`

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Copy requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install gunicorn for production
RUN pip install --no-cache-dir gunicorn

# Copy application
COPY . .

# Create non-root user
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD python -c "import requests; requests.get('http://localhost:8000/health')" || exit 1

# Run with gunicorn
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "--workers", "4", "app:app"]
```

## Django Application

**File**: `Dockerfile`

```dockerfile
FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install --no-cache-dir gunicorn

COPY . .

# Create non-root user
RUN useradd -m -u 1000 django && chown -R django:django /app
USER django

# Collect static files
RUN python manage.py collectstatic --noinput

EXPOSE 8000

# Run with gunicorn
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "--workers", "4", "myproject.wsgi:application"]
```

**Separate static files with multi-stage**:
```dockerfile
FROM python:3.11-slim AS builder

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
RUN python manage.py collectstatic --noinput

FROM python:3.11-slim

RUN apt-get update && apt-get install -y postgresql-client && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt gunicorn

COPY --from=builder /app .

RUN useradd -m -u 1000 django && chown -R django:django /app
USER django

EXPOSE 8000

CMD ["gunicorn", "--bind", "0.0.0.0:8000", "--workers", "4", "myproject.wsgi:application"]
```

## FastAPI Application

**File**: `Dockerfile`

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install uvicorn for production
RUN pip install --no-cache-dir "uvicorn[standard]"

COPY . .

RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD python -c "import requests; requests.get('http://localhost:8000/health')" || exit 1

# Run with uvicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**For production with multiple workers**:
```dockerfile
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
```

## With Poetry

**File**: `Dockerfile`

```dockerfile
FROM python:3.11-slim

# Install poetry
RUN pip install --no-cache-dir poetry

WORKDIR /app

# Copy poetry files
COPY pyproject.toml poetry.lock ./

# Install dependencies (without dev dependencies)
RUN poetry config virtualenvs.create false \
    && poetry install --no-interaction --no-ansi --only main

COPY . .

RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

CMD ["python", "app.py"]
```

## With Pipenv

**File**: `Dockerfile`

```dockerfile
FROM python:3.11-slim

# Install pipenv
RUN pip install --no-cache-dir pipenv

WORKDIR /app

# Copy Pipfile
COPY Pipfile Pipfile.lock ./

# Install dependencies to system python
RUN pipenv install --system --deploy --ignore-pipfile

COPY . .

RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

CMD ["python", "app.py"]
```

## Multi-Stage Build (Optimized)

For smaller production images

**File**: `Dockerfile`

```dockerfile
# Build stage
FROM python:3.11-slim AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --user --no-cache-dir -r requirements.txt

# Production stage
FROM python:3.11-slim

WORKDIR /app

# Copy only installed packages
COPY --from=builder /root/.local /root/.local

# Update PATH
ENV PATH=/root/.local/bin:$PATH

COPY . .

RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

CMD ["python", "app.py"]
```

## With System Dependencies

For packages requiring compilation (numpy, pandas, pillow, etc.)

**File**: `Dockerfile`

```dockerfile
FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    gfortran \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

CMD ["python", "app.py"]
```

**Better: Use pre-compiled wheels**
```dockerfile
# For data science apps, use official image with pre-compiled packages
FROM continuumio/miniconda3

WORKDIR /app

COPY environment.yml .
RUN conda env create -f environment.yml

COPY . .

CMD ["conda", "run", "-n", "myenv", "python", "app.py"]
```

## Celery Worker

**File**: `Dockerfile.worker`

```dockerfile
FROM python:3.11-slim

RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN useradd -m -u 1000 celery && chown -R celery:celery /app
USER celery

# No EXPOSE needed for worker

CMD ["celery", "-A", "tasks", "worker", "--loglevel=info"]
```

**With docker-compose.yml**:
```yaml
services:
  web:
    build: .
    ports:
      - "8000:8000"

  worker:
    build:
      context: .
      dockerfile: Dockerfile.worker
    depends_on:
      - redis

  redis:
    image: redis:7-alpine
```

## With Environment Configuration

**File**: `Dockerfile`

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

# Environment variables (with defaults)
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000 \
    LOG_LEVEL=info

# Override at runtime:
# docker run -e PORT=8080 -e LOG_LEVEL=debug myapp

CMD ["python", "app.py"]
```

## Jupyter Notebook

**File**: `Dockerfile`

```dockerfile
FROM python:3.11-slim

WORKDIR /notebooks

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt jupyter

EXPOSE 8888

# Create token for authentication
ENV JUPYTER_TOKEN=your-secret-token

CMD ["jupyter", "notebook", "--ip=0.0.0.0", "--port=8888", "--no-browser", "--allow-root"]
```

**Usage**:
```bash
docker run -p 8888:8888 -v $(pwd)/notebooks:/notebooks mynotebook
# Access at http://localhost:8888?token=your-secret-token
```

## Best Practices Checklist

When creating Python Dockerfile:

- [ ] Use `python:3.11-slim` (not `python:3.11` - it's 3x larger)
- [ ] Pin specific version (e.g., `python:3.11.5-slim`)
- [ ] Copy `requirements.txt` before source code
- [ ] Use `--no-cache-dir` with pip to reduce image size
- [ ] Set `PYTHONUNBUFFERED=1` to see logs in real-time
- [ ] Set `PYTHONDONTWRITEBYTECODE=1` to avoid .pyc files
- [ ] Run as non-root user
- [ ] Use `WORKDIR /app`
- [ ] Document ports with `EXPOSE`
- [ ] Use environment variables for config
- [ ] Include health check for web apps
- [ ] Create `.dockerignore` file
- [ ] Use multi-stage builds for compiled dependencies

## Common Patterns

### Install from Private PyPI

```dockerfile
RUN pip install --no-cache-dir \
    --index-url https://pypi.org/simple \
    --extra-index-url https://your-private-pypi.com/simple \
    -r requirements.txt
```

### Install from Git Repository

```dockerfile
RUN pip install --no-cache-dir git+https://github.com/user/repo.git@v1.0.0
```

### Create Virtual Environment Inside Container

```dockerfile
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip install --no-cache-dir -r requirements.txt
```

### Application Logging

```python
import logging
import sys

# Log to stdout for docker logs
logging.basicConfig(
    stream=sys.stdout,
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
```

### Graceful Shutdown

```python
import signal
import sys

def signal_handler(sig, frame):
    print('Shutting down gracefully...')
    # Cleanup code here
    sys.exit(0)

signal.signal(signal.SIGTERM, signal_handler)
signal.signal(signal.SIGINT, signal_handler)
```

## Keep It Simple

Start with the simple production template. Only add complexity when needed:

1. **Simple** → Start here
2. **With System Deps** → Only if you need gcc/build tools
3. **Multi-Stage** → Only if image size is a problem
4. **Poetry/Pipenv** → Only if already using them

Most Python apps need just the simple template with pip and requirements.txt.
