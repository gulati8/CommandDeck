# Deployment Strategies

Patterns for deploying applications with minimal risk and downtime.

## Strategy Comparison

| Strategy | Downtime | Rollback | Resource Cost | Complexity |
|----------|----------|----------|---------------|------------|
| Recreate | Yes | Slow | Low | Low |
| Rolling | No | Medium | Medium | Low |
| Blue-Green | No | Fast | High | Medium |
| Canary | No | Fast | Medium | High |
| A/B Testing | No | Fast | Medium | High |

## Rolling Deployment

### Kubernetes Rolling Update

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
spec:
  replicas: 4
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1        # Max pods above desired
      maxUnavailable: 1  # Max pods unavailable
  template:
    spec:
      containers:
        - name: myapp
          image: myapp:v2
          readinessProbe:
            httpGet:
              path: /ready
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 5
```

### Process

```
Time →
Pod 1: [v1] [v1] [v1] [v1] [v2] [v2] [v2]
Pod 2: [v1] [v1] [v1] [v2] [v2] [v2] [v2]
Pod 3: [v1] [v1] [v2] [v2] [v2] [v2] [v2]
Pod 4: [v1] [v2] [v2] [v2] [v2] [v2] [v2]
```

## Blue-Green Deployment

### Architecture

```
                   ┌─────────────┐
                   │   Router    │
                   └──────┬──────┘
                          │
         ┌────────────────┴────────────────┐
         │                                 │
         ▼                                 ▼
┌─────────────────┐               ┌─────────────────┐
│   Blue (v1)     │               │   Green (v2)    │
│   Active        │               │   Staging       │
└─────────────────┘               └─────────────────┘
```

### Kubernetes Implementation

```yaml
# blue-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp-blue
  labels:
    app: myapp
    version: blue
spec:
  replicas: 3
  selector:
    matchLabels:
      app: myapp
      version: blue
  template:
    metadata:
      labels:
        app: myapp
        version: blue
    spec:
      containers:
        - name: myapp
          image: myapp:v1
---
# green-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp-green
  labels:
    app: myapp
    version: green
spec:
  replicas: 3
  selector:
    matchLabels:
      app: myapp
      version: green
  template:
    metadata:
      labels:
        app: myapp
        version: green
    spec:
      containers:
        - name: myapp
          image: myapp:v2
---
# service.yaml - Switch between blue/green
apiVersion: v1
kind: Service
metadata:
  name: myapp
spec:
  selector:
    app: myapp
    version: blue  # Change to 'green' to switch
  ports:
    - port: 80
      targetPort: 3000
```

### Switch Traffic

```bash
# Deploy green
kubectl apply -f green-deployment.yaml

# Test green internally
kubectl port-forward deployment/myapp-green 8080:3000

# Switch traffic to green
kubectl patch service myapp -p '{"spec":{"selector":{"version":"green"}}}'

# Rollback to blue if needed
kubectl patch service myapp -p '{"spec":{"selector":{"version":"blue"}}}'

# Clean up old deployment
kubectl delete deployment myapp-blue
```

## Canary Deployment

### Weighted Traffic Split

```yaml
# Using Istio VirtualService
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: myapp
spec:
  hosts:
    - myapp
  http:
    - route:
        - destination:
            host: myapp
            subset: stable
          weight: 90
        - destination:
            host: myapp
            subset: canary
          weight: 10
---
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: myapp
spec:
  host: myapp
  subsets:
    - name: stable
      labels:
        version: v1
    - name: canary
      labels:
        version: v2
```

### Progressive Rollout

```yaml
# Using Argo Rollouts
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: myapp
spec:
  replicas: 10
  strategy:
    canary:
      steps:
        - setWeight: 10
        - pause: { duration: 5m }
        - setWeight: 25
        - pause: { duration: 5m }
        - setWeight: 50
        - pause: { duration: 5m }
        - setWeight: 75
        - pause: { duration: 5m }
      analysis:
        templates:
          - templateName: success-rate
        startingStep: 2
  selector:
    matchLabels:
      app: myapp
  template:
    metadata:
      labels:
        app: myapp
    spec:
      containers:
        - name: myapp
          image: myapp:v2
```

### Canary Analysis

```yaml
apiVersion: argoproj.io/v1alpha1
kind: AnalysisTemplate
metadata:
  name: success-rate
spec:
  metrics:
    - name: success-rate
      interval: 1m
      successCondition: result[0] >= 0.95
      provider:
        prometheus:
          address: http://prometheus:9090
          query: |
            sum(rate(http_requests_total{status=~"2.."}[5m]))
            /
            sum(rate(http_requests_total[5m]))
```

## Feature Flags

### Implementation

```typescript
import { createClient } from '@vercel/flags';

const flags = createClient({
  apiKey: process.env.FLAGS_API_KEY,
});

// Check flag
async function showNewFeature(userId: string): Promise<boolean> {
  return flags.isEnabled('new-feature', {
    userId,
    userAttributes: {
      plan: 'premium',
      country: 'US',
    },
  });
}

// Usage
app.get('/dashboard', async (req, res) => {
  const showNewUI = await showNewFeature(req.user.id);

  if (showNewUI) {
    res.render('dashboard-v2');
  } else {
    res.render('dashboard');
  }
});
```

### Progressive Rollout with Flags

```typescript
// Flag configuration
{
  "new-dashboard": {
    "type": "percentage",
    "percentage": 10,        // Start with 10%
    "conditions": [
      {
        "attribute": "plan",
        "operator": "in",
        "value": ["enterprise", "premium"]
      }
    ]
  }
}

// Gradually increase percentage
// Day 1: 10%
// Day 2: 25%
// Day 3: 50%
// Day 4: 100%
```

## Rollback Strategies

### Kubernetes Rollback

```bash
# View rollout history
kubectl rollout history deployment/myapp

# Rollback to previous version
kubectl rollout undo deployment/myapp

# Rollback to specific revision
kubectl rollout undo deployment/myapp --to-revision=2

# Check rollout status
kubectl rollout status deployment/myapp
```

### Database Migration Rollback

```typescript
// migrations/20240115_add_column.ts
export async function up(db: Knex): Promise<void> {
  await db.schema.alterTable('users', (table) => {
    table.string('new_column');
  });
}

export async function down(db: Knex): Promise<void> {
  await db.schema.alterTable('users', (table) => {
    table.dropColumn('new_column');
  });
}

// Rollback command
// npx knex migrate:rollback
```

## Pre-Deployment Checks

```yaml
# GitHub Actions pre-deployment
jobs:
  pre-deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Run tests
        run: npm test

      - name: Run E2E tests
        run: npm run test:e2e

      - name: Security scan
        run: npm audit --production

      - name: Build check
        run: npm run build

      - name: Smoke test staging
        run: |
          curl -f https://staging.example.com/health || exit 1

  deploy:
    needs: pre-deploy
    runs-on: ubuntu-latest
    steps:
      - name: Deploy
        run: ./deploy.sh
```

## Best Practices

### Zero-Downtime Checklist
- [ ] Health checks configured
- [ ] Readiness probes working
- [ ] Graceful shutdown implemented
- [ ] Database migrations are backwards-compatible
- [ ] Connection draining configured
- [ ] Rollback plan documented and tested

### Monitoring During Deployment
- Watch error rates
- Monitor latency percentiles
- Check resource utilization
- Verify health check success rate
- Monitor database connections

### Rollback Triggers
- Error rate > 5%
- P95 latency > 2x baseline
- Health check failures
- Customer complaints
- Manual trigger available
