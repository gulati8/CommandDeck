# CI/CD Patterns

Common patterns for continuous integration and continuous deployment.

## Pipeline Stages

```
┌─────────┐   ┌───────┐   ┌───────┐   ┌─────────┐   ┌────────┐
│  Build  │ → │ Test  │ → │ Scan  │ → │ Package │ → │ Deploy │
└─────────┘   └───────┘   └───────┘   └─────────┘   └────────┘
```

## GitHub Actions Examples

### Basic Node.js Pipeline

```yaml
name: CI/CD

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - run: npm ci
      - run: npm run lint
      - run: npm run test

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - run: npm ci
      - run: npm run build

      - uses: actions/upload-artifact@v4
        with:
          name: build
          path: dist/
```

### Docker Build and Push

```yaml
name: Docker Build

on:
  push:
    branches: [main]
    tags: ['v*']

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - uses: actions/checkout@v4

      - uses: docker/setup-buildx-action@v3

      - uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - uses: docker/metadata-action@v5
        id: meta
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=sha
            type=ref,event=branch
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}

      - uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

### Matrix Testing

```yaml
jobs:
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
        node: [18, 20, 22]
        exclude:
          - os: macos-latest
            node: 18
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node }}
      - run: npm ci
      - run: npm test
```

### Environment Deployments

```yaml
jobs:
  deploy-staging:
    runs-on: ubuntu-latest
    environment: staging
    if: github.ref == 'refs/heads/develop'
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to staging
        env:
          API_URL: ${{ vars.API_URL }}
          API_KEY: ${{ secrets.API_KEY }}
        run: |
          ./deploy.sh staging

  deploy-production:
    runs-on: ubuntu-latest
    environment: production
    if: github.ref == 'refs/heads/main'
    needs: deploy-staging
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to production
        run: ./deploy.sh production
```

## GitLab CI Examples

### Basic Pipeline

```yaml
stages:
  - test
  - build
  - deploy

variables:
  NODE_VERSION: "20"

test:
  stage: test
  image: node:${NODE_VERSION}
  cache:
    paths:
      - node_modules/
  script:
    - npm ci
    - npm run lint
    - npm run test

build:
  stage: build
  image: node:${NODE_VERSION}
  script:
    - npm ci
    - npm run build
  artifacts:
    paths:
      - dist/
    expire_in: 1 hour

deploy-staging:
  stage: deploy
  environment:
    name: staging
    url: https://staging.example.com
  script:
    - ./deploy.sh staging
  only:
    - develop

deploy-production:
  stage: deploy
  environment:
    name: production
    url: https://example.com
  script:
    - ./deploy.sh production
  only:
    - main
  when: manual
```

## Pipeline Patterns

### Trunk-Based Development

```yaml
# Main branch always deployable
# Feature branches short-lived
# Deploy on every main commit

on:
  push:
    branches: [main]

jobs:
  test:
    # Fast tests only
  deploy:
    needs: test
    # Deploy immediately
```

### GitFlow

```yaml
on:
  push:
    branches: [main, develop, 'release/*']

jobs:
  test:
    # Always test

  deploy-staging:
    if: github.ref == 'refs/heads/develop'
    # Deploy develop to staging

  deploy-production:
    if: startsWith(github.ref, 'refs/heads/release/')
    # Deploy release branch to production
```

### Feature Branch Preview

```yaml
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  preview:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy preview
        run: |
          PREVIEW_URL="https://pr-${{ github.event.number }}.preview.example.com"
          ./deploy.sh preview $PREVIEW_URL

      - name: Comment PR
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              body: '🚀 Preview: https://pr-${{ github.event.number }}.preview.example.com'
            })
```

## Quality Gates

### Required Checks

```yaml
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - run: npm run lint

  test:
    runs-on: ubuntu-latest
    steps:
      - run: npm test

  security:
    runs-on: ubuntu-latest
    steps:
      - run: npm audit --production
      - uses: aquasecurity/trivy-action@master

  coverage:
    runs-on: ubuntu-latest
    steps:
      - run: npm run test:coverage
      - name: Check coverage
        run: |
          COVERAGE=$(cat coverage/coverage-summary.json | jq '.total.lines.pct')
          if (( $(echo "$COVERAGE < 80" | bc -l) )); then
            echo "Coverage $COVERAGE% is below 80%"
            exit 1
          fi
```

### Branch Protection

```yaml
# .github/settings.yml (for probot/settings app)
branches:
  - name: main
    protection:
      required_pull_request_reviews:
        required_approving_review_count: 1
      required_status_checks:
        strict: true
        contexts:
          - lint
          - test
          - security
      enforce_admins: false
```

## Caching Strategies

```yaml
# npm cache
- uses: actions/setup-node@v4
  with:
    cache: 'npm'

# Custom cache
- uses: actions/cache@v4
  with:
    path: |
      ~/.npm
      node_modules
    key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
    restore-keys: |
      ${{ runner.os }}-node-

# Docker layer cache
- uses: docker/build-push-action@v5
  with:
    cache-from: type=gha
    cache-to: type=gha,mode=max
```

## Secrets Management

```yaml
jobs:
  deploy:
    steps:
      # Use GitHub secrets
      - env:
          API_KEY: ${{ secrets.API_KEY }}

      # Use environment-specific secrets
      - env:
          DB_URL: ${{ secrets.DB_URL }}
        environment: production

      # Mask sensitive output
      - run: |
          echo "::add-mask::${{ secrets.API_KEY }}"
```

## Best Practices

### Fast Feedback
- Run quick tests first (lint, unit tests)
- Parallelize independent jobs
- Use caching aggressively

### Fail Fast
- Exit on first error
- Don't continue after critical failures
- Provide clear error messages

### Reproducible Builds
- Pin dependency versions
- Use lock files
- Tag Docker images with commit SHA

### Security
- Scan for vulnerabilities
- Use least-privilege tokens
- Don't expose secrets in logs
