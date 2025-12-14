# .dockerignore Templates

The `.dockerignore` file tells Docker which files to exclude from the build context. This makes builds faster and prevents secrets from leaking into images.

**Location**: Place in same directory as Dockerfile (usually project root)

## Why .dockerignore?

**Benefits**:
- Faster builds (smaller context)
- Smaller images (excludes unnecessary files)
- Security (prevents secrets in images)
- Cleaner (no .git, cache files, etc.)

**Without .dockerignore**: Docker sends ALL files to build context
**With .dockerignore**: Docker only sends necessary files

## Universal .dockerignore

Works for most projects

**File**: `.dockerignore`

```
# Version control
.git
.gitignore
.gitattributes

# CI/CD
.github
.gitlab-ci.yml
.travis.yml
.circleci

# IDE
.vscode
.idea
*.swp
*.swo
*~
.DS_Store

# Documentation
README.md
CHANGELOG.md
LICENSE
docs/
*.md

# Docker
Dockerfile*
docker-compose*.yml
.dockerignore

# Tests
tests/
test/
spec/
*.test.js
*.spec.js
__tests__/
coverage/

# Logs
*.log
logs/
npm-debug.log*

# Environment
.env
.env.*
!.env.example

# Dependencies (will be installed in container)
node_modules/
vendor/
```

## Node.js .dockerignore

**File**: `.dockerignore`

```
# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.pnpm-debug.log*

# Build outputs
dist/
build/
.next/
out/
.cache/

# Testing
coverage/
.nyc_output/
*.test.js
*.spec.js
__tests__/
test/

# Environment
.env
.env.local
.env.*.local
!.env.example

# IDE
.vscode/
.idea/
*.swp
*.swo
.DS_Store

# Version control
.git/
.gitignore

# Documentation
README.md
docs/
*.md

# CI/CD
.github/
.gitlab-ci.yml

# Misc
*.log
.eslintrc*
.prettierrc*
jest.config.js
tsconfig.json  # If building TypeScript
```

## Python .dockerignore

**File**: `.dockerignore`

```
# Python cache
__pycache__/
*.py[cod]
*$py.class
*.so
.Python

# Virtual environments
venv/
env/
ENV/
.venv

# Distribution / packaging
build/
dist/
*.egg-info/
.eggs/

# Testing
.pytest_cache/
.coverage
.tox/
htmlcov/
*.cover
.hypothesis/

# Environment
.env
.env.*
!.env.example

# IDE
.vscode/
.idea/
*.swp
.DS_Store

# Version control
.git/
.gitignore

# Documentation
README.md
docs/
*.md

# Jupyter
.ipynb_checkpoints/
*.ipynb

# Database
*.db
*.sqlite3

# Logs
*.log
```

## Go .dockerignore

**File**: `.dockerignore`

```
# Binaries
*.exe
*.exe~
*.dll
*.so
*.dylib
main

# Test files
*_test.go
testdata/

# Build output
bin/
dist/

# Go specific
*.out
vendor/  # If using modules

# IDE
.vscode/
.idea/
*.swp
.DS_Store

# Version control
.git/
.gitignore

# Documentation
README.md
docs/
*.md

# Environment
.env
.env.*
!.env.example

# CI/CD
.github/
.gitlab-ci.yml

# Logs
*.log
```

## Full-Stack Project

When you have multiple apps (frontend, backend, etc.)

**File**: `.dockerignore` (at project root)

```
# Version control
.git/
.gitignore

# IDE
.vscode/
.idea/
*.swp
.DS_Store

# Documentation
README.md
docs/
*.md

# CI/CD
.github/
.gitlab-ci.yml

# Docker files
docker-compose*.yml

# Environment
.env
.env.*
!.env.example

# Logs
*.log

# Ignore other app directories when building
# (Each app has its own Dockerfile)
frontend/node_modules/
backend/node_modules/
backend/__pycache__/
backend/venv/
```

**File**: `frontend/.dockerignore`

```
node_modules/
.next/
build/
dist/
coverage/
.env.local
*.test.js
*.spec.js
```

**File**: `backend/.dockerignore`

```
__pycache__/
*.pyc
venv/
.pytest_cache/
.coverage
.env
*.test.py
```

## Security-Focused .dockerignore

Emphasizes preventing secrets in images

**File**: `.dockerignore`

```
# CRITICAL: Secrets and credentials
.env
.env.*
!.env.example
*.pem
*.key
*.crt
*.p12
credentials.json
secrets/
.ssh/
.gnupg/

# CRITICAL: Sensitive data
*.db
*.sqlite
*.sqlite3
data/
backups/

# Cloud credentials
.aws/
.gcloud/
.azure/

# Version control
.git/
.gitignore

# IDE
.vscode/
.idea/
*.swp
.DS_Store

# Documentation
README.md
docs/
*.md

# CI/CD
.github/
.gitlab-ci.yml

# Dependencies (will reinstall)
node_modules/
vendor/
venv/

# Build artifacts
dist/
build/
*.log
```

## Monorepo .dockerignore

When multiple apps share same root

**File**: `.dockerignore`

```
# Global ignores
.git/
.gitignore
.vscode/
.idea/
.DS_Store
README.md
docs/

# Ignore all apps except the one being built
# Override in build command with:
# docker build -f apps/backend/Dockerfile .

# Dependencies (reinstall in container)
**/node_modules/
**/__pycache__/
**/venv/
**/vendor/

# Build outputs
**/dist/
**/build/
**/.next/

# Tests
**/*.test.*
**/*.spec.*
**/coverage/

# Environment
**/.env
**/.env.local
!**/.env.example

# Logs
**/*.log
```

## Patterns and Examples

### Negation (Include Specific Files)

```
# Ignore all markdown files
*.md

# Except README
!README.md
```

### Ignore Directory but Keep Subdirectory

```
# Ignore logs directory
logs/

# But keep empty .gitkeep
!logs/.gitkeep
```

### Wildcard Patterns

```
# All log files anywhere
**/*.log

# Log files in root only
/*.log

# Specific pattern
test-*.js
```

### Multiple Extensions

```
# Source files
src/**/*.ts
src/**/*.tsx
src/**/*.js
src/**/*.jsx
```

## Common Mistakes

### ❌ Don't Ignore Package Files

```
# BAD: Docker can't install dependencies
package.json
requirements.txt
go.mod
```

### ❌ Don't Ignore Source Code

```
# BAD: Docker can't build app
src/
*.py
*.js
```

### ✅ Do Ignore Build Outputs

```
# GOOD: These are rebuilt in container
dist/
build/
*.pyc
```

### ✅ Do Ignore Dependencies

```
# GOOD: These are installed in container
node_modules/
venv/
vendor/
```

## Testing .dockerignore

**Check what's being sent to Docker**:

```bash
# Build and watch context
docker build --progress=plain -t myapp .

# Or manually check
docker build --no-cache -t myapp . 2>&1 | grep "Sending build context"
```

**Verify .dockerignore works**:

```bash
# Create test file
touch secret.key

# Add to .dockerignore
echo "secret.key" >> .dockerignore

# Build and check image
docker build -t myapp .
docker run --rm myapp ls -la /
# secret.key should NOT be there
```

## Quick Reference

| Pattern | Matches |
|---------|---------|
| `file.txt` | file.txt in root |
| `*.log` | All .log files in root |
| `**/*.log` | All .log files anywhere |
| `temp/` | temp directory and contents |
| `!important.txt` | Negation (include file) |
| `# comment` | Comment line |

## Best Practices

1. **Start with template** above for your language
2. **Always exclude secrets** (.env, *.key, credentials.json)
3. **Exclude dependencies** (node_modules, venv, vendor)
4. **Exclude build outputs** (dist, build, *.pyc)
5. **Exclude VCS** (.git, .gitignore)
6. **Exclude IDE files** (.vscode, .idea, .DS_Store)
7. **Keep it simple** - don't over-complicate
8. **Test it** - verify secrets aren't in image

## Keep It Simple

Most projects need just:
```
# Version control and IDE
.git
.vscode
.DS_Store

# Dependencies (reinstall in container)
node_modules
__pycache__
venv

# Secrets
.env

# Tests and docs
tests/
*.test.js
*.md
```

Start with this minimal version, add more only when needed.
