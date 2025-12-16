# Monitoring and Observability

Patterns for logging, metrics, tracing, and alerting.

## The Three Pillars

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│    Logs     │  │   Metrics   │  │   Traces    │
│             │  │             │  │             │
│ What        │  │ How much/   │  │ Request     │
│ happened    │  │ How often   │  │ flow        │
└─────────────┘  └─────────────┘  └─────────────┘
```

## Structured Logging

### Log Format

```typescript
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
  base: {
    service: 'myapp',
    environment: process.env.NODE_ENV,
    version: process.env.APP_VERSION,
  },
});

// Good: Structured log
logger.info({
  event: 'user.created',
  userId: user.id,
  email: user.email,
  duration: 150,
});

// Bad: Unstructured log
console.log(`User created: ${user.id}`);
```

### Log Levels

```typescript
// ERROR - Application errors requiring investigation
logger.error({ err, userId }, 'Failed to process payment');

// WARN - Unexpected but handled conditions
logger.warn({ userId, attempts: 3 }, 'Rate limit approaching');

// INFO - Business events and state changes
logger.info({ orderId, status: 'completed' }, 'Order completed');

// DEBUG - Detailed debugging information
logger.debug({ query, params, duration }, 'Database query executed');

// TRACE - Very detailed tracing (usually disabled)
logger.trace({ request }, 'Incoming request');
```

### Request Logging Middleware

```typescript
import { v4 as uuid } from 'uuid';

function requestLogger(req, res, next) {
  const requestId = req.headers['x-request-id'] || uuid();
  const startTime = Date.now();

  // Attach to request for use in handlers
  req.requestId = requestId;
  req.log = logger.child({ requestId });

  // Log request
  req.log.info({
    event: 'http.request.start',
    method: req.method,
    url: req.url,
    userAgent: req.headers['user-agent'],
  });

  // Log response
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    req.log.info({
      event: 'http.request.complete',
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
    });
  });

  next();
}
```

## Metrics

### Prometheus Metrics

```typescript
import { Registry, Counter, Histogram, Gauge } from 'prom-client';

const registry = new Registry();

// Counter - monotonically increasing
const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'path', 'status'],
  registers: [registry],
});

// Histogram - distributions
const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'path'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 5],
  registers: [registry],
});

// Gauge - can go up and down
const activeConnections = new Gauge({
  name: 'active_connections',
  help: 'Number of active connections',
  registers: [registry],
});

// Middleware
function metricsMiddleware(req, res, next) {
  const end = httpRequestDuration.startTimer({
    method: req.method,
    path: req.route?.path || req.path,
  });

  res.on('finish', () => {
    end();
    httpRequestsTotal.inc({
      method: req.method,
      path: req.route?.path || req.path,
      status: res.statusCode,
    });
  });

  next();
}

// Expose metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', registry.contentType);
  res.end(await registry.metrics());
});
```

### Business Metrics

```typescript
// Track business events
const ordersCreated = new Counter({
  name: 'orders_created_total',
  help: 'Total orders created',
  labelNames: ['payment_method', 'currency'],
});

const orderValue = new Histogram({
  name: 'order_value_dollars',
  help: 'Order value in dollars',
  buckets: [10, 50, 100, 500, 1000, 5000],
});

// In business logic
async function createOrder(data) {
  const order = await db.insert(data);

  ordersCreated.inc({
    payment_method: data.paymentMethod,
    currency: data.currency,
  });
  orderValue.observe(data.total);

  return order;
}
```

## Distributed Tracing

### OpenTelemetry Setup

```typescript
import { NodeSDK } from '@opentelemetry/sdk-node';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

const sdk = new NodeSDK({
  serviceName: 'myapp',
  traceExporter: new OTLPTraceExporter({
    url: 'http://jaeger:4318/v1/traces',
  }),
  instrumentations: [
    new HttpInstrumentation(),
    new ExpressInstrumentation(),
    new PgInstrumentation(),
  ],
});

sdk.start();
```

### Manual Spans

```typescript
import { trace, SpanStatusCode } from '@opentelemetry/api';

const tracer = trace.getTracer('myapp');

async function processOrder(orderId: string) {
  return tracer.startActiveSpan('processOrder', async (span) => {
    try {
      span.setAttribute('order.id', orderId);

      // Child span for payment
      const payment = await tracer.startActiveSpan('chargePayment', async (paymentSpan) => {
        const result = await paymentGateway.charge(orderId);
        paymentSpan.setAttribute('payment.amount', result.amount);
        paymentSpan.end();
        return result;
      });

      // Child span for notification
      await tracer.startActiveSpan('sendNotification', async (notifySpan) => {
        await emailService.send(orderId);
        notifySpan.end();
      });

      span.setStatus({ code: SpanStatusCode.OK });
      return payment;
    } catch (error) {
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
    }
  });
}
```

## Health Checks

```typescript
// Health endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

// Readiness endpoint (dependencies ready)
app.get('/ready', async (req, res) => {
  const checks = await Promise.allSettled([
    checkDatabase(),
    checkRedis(),
    checkExternalApi(),
  ]);

  const results = {
    database: checks[0].status === 'fulfilled',
    redis: checks[1].status === 'fulfilled',
    externalApi: checks[2].status === 'fulfilled',
  };

  const allHealthy = Object.values(results).every(Boolean);

  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'ready' : 'not ready',
    checks: results,
  });
});

async function checkDatabase() {
  await db.raw('SELECT 1');
}

async function checkRedis() {
  await redis.ping();
}
```

## Alerting

### Prometheus Alerting Rules

```yaml
# alerts/app-alerts.yml
groups:
  - name: app-alerts
    rules:
      - alert: HighErrorRate
        expr: |
          sum(rate(http_requests_total{status=~"5.."}[5m]))
          /
          sum(rate(http_requests_total[5m]))
          > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: High error rate detected
          description: Error rate is {{ $value | humanizePercentage }}

      - alert: HighLatency
        expr: |
          histogram_quantile(0.95,
            sum(rate(http_request_duration_seconds_bucket[5m])) by (le)
          ) > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: High latency detected
          description: 95th percentile latency is {{ $value | humanizeDuration }}

      - alert: ServiceDown
        expr: up == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: Service is down
          description: "{{ $labels.instance }} has been down for more than 1 minute"
```

## Dashboards

### Key Metrics to Display

```
Request Rate:       rate(http_requests_total[5m])
Error Rate:         rate(http_requests_total{status=~"5.."}[5m])
Latency P50:        histogram_quantile(0.5, rate(http_request_duration_seconds_bucket[5m]))
Latency P95:        histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
Latency P99:        histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))
Active Connections: active_connections
Memory Usage:       process_resident_memory_bytes
CPU Usage:          rate(process_cpu_seconds_total[5m])
```

## Best Practices

### Logging
- Use structured JSON logs
- Include correlation IDs
- Don't log sensitive data (PII, secrets)
- Set appropriate log levels per environment

### Metrics
- Use standard naming conventions
- Add meaningful labels (but not too many)
- Track business metrics, not just technical
- Use histograms for latency, not averages

### Tracing
- Instrument all entry/exit points
- Add meaningful span attributes
- Propagate context across services
- Sample in production to reduce overhead

### Alerting
- Alert on symptoms, not causes
- Include runbook links in alerts
- Avoid alert fatigue
- Page only for actionable issues
