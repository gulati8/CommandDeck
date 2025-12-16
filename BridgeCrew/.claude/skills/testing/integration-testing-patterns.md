# Integration Testing Patterns

Patterns for testing component interactions and API integrations.

## API Integration Testing

### Supertest Setup

```typescript
import request from 'supertest';
import { app } from '../src/app';
import { db } from '../src/db';

describe('User API', () => {
  beforeAll(async () => {
    await db.migrate.latest();
  });

  afterAll(async () => {
    await db.destroy();
  });

  beforeEach(async () => {
    await db('users').truncate();
  });

  it('GET /users returns list of users', async () => {
    // Seed data
    await db('users').insert([
      { id: '1', email: 'user1@example.com', name: 'User 1' },
      { id: '2', email: 'user2@example.com', name: 'User 2' },
    ]);

    const response = await request(app)
      .get('/api/users')
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body.data).toHaveLength(2);
    expect(response.body.data[0]).toMatchObject({
      email: 'user1@example.com',
      name: 'User 1',
    });
  });

  it('POST /users creates a new user', async () => {
    const response = await request(app)
      .post('/api/users')
      .send({ email: 'new@example.com', name: 'New User' })
      .expect(201);

    expect(response.body.data.id).toBeDefined();
    expect(response.body.data.email).toBe('new@example.com');

    // Verify in database
    const dbUser = await db('users')
      .where('id', response.body.data.id)
      .first();
    expect(dbUser.email).toBe('new@example.com');
  });

  it('POST /users returns 400 for invalid email', async () => {
    const response = await request(app)
      .post('/api/users')
      .send({ email: 'invalid-email', name: 'Test' })
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});
```

### Testing Authentication

```typescript
describe('Protected Routes', () => {
  let authToken: string;

  beforeAll(async () => {
    // Create test user and get token
    await db('users').insert({
      id: '1',
      email: 'test@example.com',
      password: await bcrypt.hash('password123', 10),
    });

    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'password123' });

    authToken = loginResponse.body.accessToken;
  });

  it('returns 401 without token', async () => {
    await request(app)
      .get('/api/profile')
      .expect(401);
  });

  it('returns 401 with invalid token', async () => {
    await request(app)
      .get('/api/profile')
      .set('Authorization', 'Bearer invalid-token')
      .expect(401);
  });

  it('returns profile with valid token', async () => {
    const response = await request(app)
      .get('/api/profile')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body.data.email).toBe('test@example.com');
  });
});
```

## Database Integration Testing

### Test Database Setup

```typescript
// test/setup.ts
import { Knex } from 'knex';
import config from '../knexfile';

const testConfig = config.test;

export async function setupTestDb(): Promise<Knex> {
  const db = knex(testConfig);
  await db.migrate.latest();
  return db;
}

export async function cleanupTestDb(db: Knex): Promise<void> {
  // Truncate all tables in reverse dependency order
  const tables = ['order_items', 'orders', 'users'];
  for (const table of tables) {
    await db.raw(`TRUNCATE TABLE ${table} CASCADE`);
  }
}

export async function seedTestData(db: Knex): Promise<void> {
  await db('users').insert(fixtures.users);
  await db('orders').insert(fixtures.orders);
}
```

### Testing Transactions

```typescript
describe('OrderService', () => {
  it('rolls back on payment failure', async () => {
    const userId = '1';
    const orderData = { items: [{ productId: '1', quantity: 2 }] };

    // Mock payment to fail
    mockPaymentGateway.charge.mockRejectedValue(new Error('Payment failed'));

    await expect(orderService.createOrder(userId, orderData))
      .rejects.toThrow('Payment failed');

    // Verify order was not created
    const orders = await db('orders').where('user_id', userId);
    expect(orders).toHaveLength(0);

    // Verify inventory was not decremented
    const product = await db('products').where('id', '1').first();
    expect(product.inventory).toBe(10); // Original amount
  });
});
```

## External Service Integration

### Mock Service Worker (MSW)

```typescript
// mocks/handlers.ts
import { rest } from 'msw';

export const handlers = [
  rest.get('https://api.stripe.com/v1/customers/:id', (req, res, ctx) => {
    return res(
      ctx.json({
        id: req.params.id,
        email: 'customer@example.com',
        created: Date.now(),
      })
    );
  }),

  rest.post('https://api.stripe.com/v1/charges', async (req, res, ctx) => {
    const body = await req.json();

    if (body.amount > 10000) {
      return res(
        ctx.status(400),
        ctx.json({ error: { message: 'Amount too large' } })
      );
    }

    return res(
      ctx.json({
        id: 'ch_test_123',
        amount: body.amount,
        status: 'succeeded',
      })
    );
  }),
];

// mocks/server.ts
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);

// test/setup.ts
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

### Testing with MSW

```typescript
import { rest } from 'msw';
import { server } from '../mocks/server';

describe('PaymentService', () => {
  it('processes payment successfully', async () => {
    const result = await paymentService.charge({
      amount: 1000,
      currency: 'usd',
    });

    expect(result.status).toBe('succeeded');
  });

  it('handles API errors', async () => {
    server.use(
      rest.post('https://api.stripe.com/v1/charges', (req, res, ctx) => {
        return res(
          ctx.status(500),
          ctx.json({ error: { message: 'Internal error' } })
        );
      })
    );

    await expect(paymentService.charge({ amount: 1000 }))
      .rejects.toThrow('Payment failed');
  });
});
```

## Testing Message Queues

```typescript
describe('OrderProcessor', () => {
  let testQueue: Queue;

  beforeAll(async () => {
    testQueue = new Queue('orders-test', { connection: redisConnection });
  });

  afterEach(async () => {
    await testQueue.drain();
  });

  it('processes order from queue', async () => {
    const orderData = { id: '1', userId: '1', total: 100 };

    // Add job to queue
    await testQueue.add('processOrder', orderData);

    // Wait for processing
    await waitFor(async () => {
      const order = await db('orders').where('id', '1').first();
      return order?.status === 'processed';
    });

    // Verify order was processed
    const order = await db('orders').where('id', '1').first();
    expect(order.status).toBe('processed');
  });

  it('handles processing errors', async () => {
    // Add invalid job
    await testQueue.add('processOrder', { id: 'invalid' });

    // Wait for failure
    await waitFor(async () => {
      const job = await testQueue.getJob('1');
      return job?.failedReason !== undefined;
    });

    // Verify error was logged
    const logs = await db('error_logs').where('context', 'LIKE', '%invalid%');
    expect(logs).toHaveLength(1);
  });
});
```

## Testing with Containers

### Testcontainers Setup

```typescript
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer } from '@testcontainers/redis';

describe('Integration Tests', () => {
  let postgresContainer: StartedTestContainer;
  let redisContainer: StartedTestContainer;
  let db: Knex;
  let redis: Redis;

  beforeAll(async () => {
    // Start containers
    postgresContainer = await new PostgreSqlContainer()
      .withDatabase('test')
      .start();

    redisContainer = await new RedisContainer().start();

    // Connect
    db = knex({
      client: 'pg',
      connection: postgresContainer.getConnectionUri(),
    });

    redis = new Redis(redisContainer.getConnectionUrl());

    await db.migrate.latest();
  }, 60000);

  afterAll(async () => {
    await db.destroy();
    await redis.quit();
    await postgresContainer.stop();
    await redisContainer.stop();
  });

  // Tests use real database and Redis
  it('caches user after first fetch', async () => {
    await db('users').insert({ id: '1', email: 'test@example.com' });

    // First call - cache miss
    const user1 = await userService.getById('1');
    expect(user1.email).toBe('test@example.com');

    // Verify cache was set
    const cached = await redis.get('user:1');
    expect(cached).toBeDefined();

    // Second call - from cache
    const user2 = await userService.getById('1');
    expect(user2).toEqual(user1);
  });
});
```

## Helper Utilities

### Wait For Condition

```typescript
async function waitFor(
  condition: () => Promise<boolean>,
  options = { timeout: 5000, interval: 100 }
): Promise<void> {
  const start = Date.now();

  while (Date.now() - start < options.timeout) {
    if (await condition()) return;
    await sleep(options.interval);
  }

  throw new Error('Timeout waiting for condition');
}

// Usage
await waitFor(async () => {
  const status = await getJobStatus(jobId);
  return status === 'completed';
});
```

### Test Data Factories

```typescript
import { faker } from '@faker-js/faker';

export const factories = {
  user: (overrides = {}) => ({
    id: faker.string.uuid(),
    email: faker.internet.email(),
    name: faker.person.fullName(),
    createdAt: faker.date.recent(),
    ...overrides,
  }),

  order: (overrides = {}) => ({
    id: faker.string.uuid(),
    userId: faker.string.uuid(),
    total: faker.number.float({ min: 10, max: 1000, precision: 0.01 }),
    status: 'pending',
    createdAt: faker.date.recent(),
    ...overrides,
  }),
};

// Usage
const user = factories.user({ email: 'specific@example.com' });
await db('users').insert(user);
```

## Best Practices

### Test Isolation
- Each test should be independent
- Clean up data before/after tests
- Don't rely on test execution order

### Realistic Data
- Use production-like data structures
- Test with edge cases (empty, large, special chars)
- Use factories for consistent test data

### Performance
- Parallelize independent tests
- Use transactions for faster cleanup
- Consider container reuse between test files
