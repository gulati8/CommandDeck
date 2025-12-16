# Test Data Management

Strategies for creating, managing, and cleaning up test data.

## Data Factories

### Basic Factory Pattern

```typescript
import { faker } from '@faker-js/faker';

// Factory functions
export const createUser = (overrides = {}) => ({
  id: faker.string.uuid(),
  email: faker.internet.email(),
  name: faker.person.fullName(),
  role: 'user',
  status: 'active',
  createdAt: new Date(),
  ...overrides,
});

export const createOrder = (overrides = {}) => ({
  id: faker.string.uuid(),
  userId: faker.string.uuid(),
  status: 'pending',
  total: faker.number.float({ min: 10, max: 1000, precision: 0.01 }),
  items: [],
  createdAt: new Date(),
  ...overrides,
});

export const createOrderItem = (overrides = {}) => ({
  id: faker.string.uuid(),
  orderId: faker.string.uuid(),
  productId: faker.string.uuid(),
  productName: faker.commerce.productName(),
  quantity: faker.number.int({ min: 1, max: 10 }),
  unitPrice: faker.number.float({ min: 5, max: 500, precision: 0.01 }),
  ...overrides,
});

// Usage
const user = createUser({ email: 'specific@test.com' });
const order = createOrder({ userId: user.id, status: 'completed' });
```

### Builder Pattern

```typescript
class UserBuilder {
  private data: Partial<User> = {};

  constructor() {
    // Defaults
    this.data = {
      id: faker.string.uuid(),
      email: faker.internet.email(),
      name: faker.person.fullName(),
      role: 'user',
      status: 'active',
    };
  }

  withEmail(email: string): this {
    this.data.email = email;
    return this;
  }

  withRole(role: 'user' | 'admin' | 'editor'): this {
    this.data.role = role;
    return this;
  }

  asAdmin(): this {
    this.data.role = 'admin';
    return this;
  }

  asInactive(): this {
    this.data.status = 'inactive';
    return this;
  }

  build(): User {
    return this.data as User;
  }
}

// Usage
const admin = new UserBuilder()
  .withEmail('admin@test.com')
  .asAdmin()
  .build();

const inactiveUser = new UserBuilder()
  .asInactive()
  .build();
```

### Relationship-Aware Factory

```typescript
class TestDataFactory {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  async createUser(overrides = {}): Promise<User> {
    const user = createUser(overrides);
    await this.db.insert('users', user);
    return user;
  }

  async createUserWithOrders(
    userOverrides = {},
    orderCount = 3
  ): Promise<{ user: User; orders: Order[] }> {
    const user = await this.createUser(userOverrides);

    const orders = await Promise.all(
      Array.from({ length: orderCount }, () =>
        this.createOrderForUser(user.id)
      )
    );

    return { user, orders };
  }

  async createOrderForUser(userId: string, overrides = {}): Promise<Order> {
    const order = createOrder({ userId, ...overrides });
    await this.db.insert('orders', order);
    return order;
  }

  async createCompleteOrder(userId: string): Promise<Order> {
    const order = await this.createOrderForUser(userId);
    const items = await this.createOrderItems(order.id, 3);
    return { ...order, items };
  }

  async createOrderItems(orderId: string, count = 3): Promise<OrderItem[]> {
    const items = Array.from({ length: count }, () =>
      createOrderItem({ orderId })
    );
    await this.db.insert('order_items', items);
    return items;
  }
}

// Usage
const factory = new TestDataFactory(db);
const { user, orders } = await factory.createUserWithOrders();
```

## Fixtures

### Static Fixtures

```typescript
// fixtures/users.ts
export const users = {
  admin: {
    id: 'admin-uuid',
    email: 'admin@test.com',
    name: 'Admin User',
    role: 'admin',
    password: '$2b$10$...', // bcrypt hash of 'adminpass'
  },
  regularUser: {
    id: 'user-uuid',
    email: 'user@test.com',
    name: 'Regular User',
    role: 'user',
    password: '$2b$10$...', // bcrypt hash of 'userpass'
  },
  inactiveUser: {
    id: 'inactive-uuid',
    email: 'inactive@test.com',
    name: 'Inactive User',
    role: 'user',
    status: 'inactive',
  },
};

// fixtures/products.ts
export const products = {
  basicProduct: {
    id: 'prod-1',
    name: 'Basic Product',
    price: 29.99,
    inventory: 100,
  },
  premiumProduct: {
    id: 'prod-2',
    name: 'Premium Product',
    price: 99.99,
    inventory: 50,
  },
  outOfStock: {
    id: 'prod-3',
    name: 'Out of Stock',
    price: 49.99,
    inventory: 0,
  },
};
```

### Loading Fixtures

```typescript
import { users } from './fixtures/users';
import { products } from './fixtures/products';

async function loadFixtures(db: Database): Promise<void> {
  // Clear existing data
  await db.raw('TRUNCATE users, products CASCADE');

  // Load fixtures
  await db.insert('users', Object.values(users));
  await db.insert('products', Object.values(products));
}

// In test setup
beforeAll(async () => {
  await loadFixtures(db);
});
```

## Database Seeding

### Seed Script

```typescript
// seeds/development.ts
import { Knex } from 'knex';
import { faker } from '@faker-js/faker';

export async function seed(knex: Knex): Promise<void> {
  // Truncate all tables
  await knex.raw('TRUNCATE users, products, orders CASCADE');

  // Create users
  const users = Array.from({ length: 10 }, () => ({
    id: faker.string.uuid(),
    email: faker.internet.email(),
    name: faker.person.fullName(),
    created_at: faker.date.past(),
  }));
  await knex('users').insert(users);

  // Create products
  const products = Array.from({ length: 50 }, () => ({
    id: faker.string.uuid(),
    name: faker.commerce.productName(),
    price: faker.commerce.price(),
    inventory: faker.number.int({ min: 0, max: 100 }),
  }));
  await knex('products').insert(products);

  // Create orders for random users
  for (const user of users.slice(0, 5)) {
    const orderCount = faker.number.int({ min: 1, max: 5 });
    for (let i = 0; i < orderCount; i++) {
      const orderId = faker.string.uuid();
      await knex('orders').insert({
        id: orderId,
        user_id: user.id,
        status: faker.helpers.arrayElement(['pending', 'completed', 'cancelled']),
        created_at: faker.date.recent(),
      });

      // Add order items
      const itemCount = faker.number.int({ min: 1, max: 3 });
      const selectedProducts = faker.helpers.arrayElements(products, itemCount);
      await knex('order_items').insert(
        selectedProducts.map((p) => ({
          id: faker.string.uuid(),
          order_id: orderId,
          product_id: p.id,
          quantity: faker.number.int({ min: 1, max: 5 }),
          unit_price: p.price,
        }))
      );
    }
  }
}
```

## Test Data Cleanup

### Transaction Rollback

```typescript
describe('UserService', () => {
  let trx: Knex.Transaction;

  beforeEach(async () => {
    trx = await db.transaction();
    // Inject transaction into services
    userService = new UserService(trx);
  });

  afterEach(async () => {
    await trx.rollback();
  });

  it('creates user', async () => {
    const user = await userService.create({ email: 'test@example.com' });
    expect(user.id).toBeDefined();
    // Data is automatically rolled back after test
  });
});
```

### Explicit Cleanup

```typescript
describe('Integration Tests', () => {
  const createdIds: { users: string[]; orders: string[] } = {
    users: [],
    orders: [],
  };

  afterEach(async () => {
    // Clean up created data
    if (createdIds.orders.length > 0) {
      await db('orders').whereIn('id', createdIds.orders).delete();
    }
    if (createdIds.users.length > 0) {
      await db('users').whereIn('id', createdIds.users).delete();
    }
    createdIds.users = [];
    createdIds.orders = [];
  });

  it('creates order for user', async () => {
    const user = await db('users').insert({ email: 'test@example.com' }).returning('*');
    createdIds.users.push(user[0].id);

    const order = await orderService.create(user[0].id, { total: 100 });
    createdIds.orders.push(order.id);

    expect(order.userId).toBe(user[0].id);
  });
});
```

### Database Reset Between Tests

```typescript
// test/helpers.ts
export async function resetDatabase(db: Database): Promise<void> {
  // Disable foreign key checks
  await db.raw('SET CONSTRAINTS ALL DEFERRED');

  // Get all table names
  const tables = await db.raw(`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename != 'migrations'
  `);

  // Truncate all tables
  for (const { tablename } of tables.rows) {
    await db.raw(`TRUNCATE TABLE "${tablename}" CASCADE`);
  }

  // Re-enable constraints
  await db.raw('SET CONSTRAINTS ALL IMMEDIATE');
}

// In tests
beforeEach(async () => {
  await resetDatabase(db);
});
```

## Test Data Isolation

### Unique Identifiers

```typescript
// Generate unique test identifiers
const testId = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

const user = await factory.createUser({
  email: `${testId}@example.com`,
  name: `Test User ${testId}`,
});

// Easy cleanup by pattern
afterAll(async () => {
  await db('users').where('email', 'like', `test_%@example.com`).delete();
});
```

### Isolated Test Databases

```typescript
// Create isolated database per test worker
const workerDb = `test_db_${process.env.VITEST_WORKER_ID}`;

beforeAll(async () => {
  await masterDb.raw(`DROP DATABASE IF EXISTS ${workerDb}`);
  await masterDb.raw(`CREATE DATABASE ${workerDb}`);
  await migrate(workerDb);
});

afterAll(async () => {
  await masterDb.raw(`DROP DATABASE ${workerDb}`);
});
```

## Best Practices

### Generate Realistic Data
- Use Faker for realistic names, emails, addresses
- Match production data patterns
- Include edge cases (empty, long, special characters)

### Keep Factories Simple
- One function per entity
- Accept overrides for customization
- Use composition for relationships

### Clean Up Aggressively
- Prefer transaction rollback when possible
- Clean up in afterEach, not afterAll
- Track created resources for cleanup

### Document Special Fixtures
- Comment why specific values are used
- Link to related tests
- Keep passwords/secrets documented for test accounts
