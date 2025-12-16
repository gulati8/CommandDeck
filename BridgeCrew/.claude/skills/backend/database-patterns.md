# Database Patterns

Common patterns for database design and data access.

## Repository Pattern

```typescript
// Generic repository interface
interface Repository<T, ID> {
  findById(id: ID): Promise<T | null>;
  findAll(options?: FindOptions): Promise<T[]>;
  create(data: Partial<T>): Promise<T>;
  update(id: ID, data: Partial<T>): Promise<T>;
  delete(id: ID): Promise<void>;
}

// User repository implementation
class UserRepository implements Repository<User, string> {
  constructor(private db: Database) {}

  async findById(id: string): Promise<User | null> {
    return this.db.query('SELECT * FROM users WHERE id = $1', [id]);
  }

  async findAll(options?: FindOptions): Promise<User[]> {
    const { limit = 20, offset = 0, orderBy = 'created_at' } = options || {};
    return this.db.query(
      `SELECT * FROM users ORDER BY ${orderBy} LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
  }

  async create(data: Partial<User>): Promise<User> {
    const { rows } = await this.db.query(
      'INSERT INTO users (email, name) VALUES ($1, $2) RETURNING *',
      [data.email, data.name]
    );
    return rows[0];
  }

  async update(id: string, data: Partial<User>): Promise<User> {
    const { rows } = await this.db.query(
      'UPDATE users SET name = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [data.name, id]
    );
    return rows[0];
  }

  async delete(id: string): Promise<void> {
    await this.db.query('DELETE FROM users WHERE id = $1', [id]);
  }

  // Domain-specific methods
  async findByEmail(email: string): Promise<User | null> {
    const { rows } = await this.db.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    return rows[0] || null;
  }
}
```

## Unit of Work Pattern

```typescript
class UnitOfWork {
  private operations: (() => Promise<void>)[] = [];
  private committed = false;

  addOperation(operation: () => Promise<void>) {
    if (this.committed) {
      throw new Error('Cannot add operations to committed unit of work');
    }
    this.operations.push(operation);
  }

  async commit(db: Database): Promise<void> {
    if (this.committed) {
      throw new Error('Unit of work already committed');
    }

    await db.transaction(async (tx) => {
      for (const operation of this.operations) {
        await operation();
      }
    });

    this.committed = true;
  }
}

// Usage
const uow = new UnitOfWork();

uow.addOperation(() => userRepo.update(userId, { status: 'active' }));
uow.addOperation(() => orderRepo.create({ userId, total: 100 }));
uow.addOperation(() => emailService.sendWelcome(userId));

await uow.commit(db);
```

## Active Record Pattern

```typescript
class User extends Model {
  static tableName = 'users';

  id!: string;
  email!: string;
  name!: string;

  // Instance methods
  async orders(): Promise<Order[]> {
    return Order.query().where('user_id', this.id);
  }

  async updateProfile(data: { name?: string }): Promise<this> {
    return this.$query().patchAndFetch(data);
  }

  // Static methods
  static async findByEmail(email: string): Promise<User | null> {
    return this.query().where('email', email).first();
  }

  static async createWithProfile(data: CreateUserData): Promise<User> {
    return this.query().insertAndFetch({
      email: data.email,
      name: data.name,
    });
  }
}

// Usage
const user = await User.findByEmail('test@example.com');
const orders = await user.orders();
await user.updateProfile({ name: 'New Name' });
```

## Query Builder Pattern

```typescript
class QueryBuilder<T> {
  private selectClause = '*';
  private whereConditions: string[] = [];
  private orderByClause = '';
  private limitValue = 0;
  private offsetValue = 0;
  private params: any[] = [];

  constructor(private tableName: string) {}

  select(...columns: string[]): this {
    this.selectClause = columns.join(', ');
    return this;
  }

  where(column: string, operator: string, value: any): this {
    this.params.push(value);
    this.whereConditions.push(`${column} ${operator} $${this.params.length}`);
    return this;
  }

  orderBy(column: string, direction: 'ASC' | 'DESC' = 'ASC'): this {
    this.orderByClause = `ORDER BY ${column} ${direction}`;
    return this;
  }

  limit(value: number): this {
    this.limitValue = value;
    return this;
  }

  offset(value: number): this {
    this.offsetValue = value;
    return this;
  }

  toSQL(): { text: string; values: any[] } {
    let sql = `SELECT ${this.selectClause} FROM ${this.tableName}`;

    if (this.whereConditions.length > 0) {
      sql += ` WHERE ${this.whereConditions.join(' AND ')}`;
    }

    if (this.orderByClause) {
      sql += ` ${this.orderByClause}`;
    }

    if (this.limitValue > 0) {
      sql += ` LIMIT ${this.limitValue}`;
    }

    if (this.offsetValue > 0) {
      sql += ` OFFSET ${this.offsetValue}`;
    }

    return { text: sql, values: this.params };
  }
}

// Usage
const query = new QueryBuilder('users')
  .select('id', 'email', 'name')
  .where('status', '=', 'active')
  .where('created_at', '>', new Date('2024-01-01'))
  .orderBy('created_at', 'DESC')
  .limit(20);

const { text, values } = query.toSQL();
const users = await db.query(text, values);
```

## Soft Delete Pattern

```sql
-- Schema
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  name VARCHAR(100),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Partial index for active records
CREATE INDEX idx_users_active ON users(email) WHERE deleted_at IS NULL;

-- Soft delete
UPDATE users SET deleted_at = NOW() WHERE id = $1;

-- Query active only
SELECT * FROM users WHERE deleted_at IS NULL;

-- Query with deleted
SELECT * FROM users;  -- Includes deleted

-- Restore
UPDATE users SET deleted_at = NULL WHERE id = $1;
```

```typescript
// Soft delete mixin
function SoftDeleteMixin<T extends Constructor>(Base: T) {
  return class extends Base {
    deletedAt: Date | null = null;

    async softDelete(): Promise<void> {
      this.deletedAt = new Date();
      await this.save();
    }

    async restore(): Promise<void> {
      this.deletedAt = null;
      await this.save();
    }

    static withDeleted() {
      return this.query();
    }

    static onlyActive() {
      return this.query().whereNull('deleted_at');
    }
  };
}
```

## Optimistic Locking

```sql
-- Schema with version column
CREATE TABLE products (
  id UUID PRIMARY KEY,
  name VARCHAR(255),
  price DECIMAL(10, 2),
  version INTEGER NOT NULL DEFAULT 1
);

-- Update with version check
UPDATE products
SET name = $1, price = $2, version = version + 1
WHERE id = $3 AND version = $4
RETURNING *;

-- If no rows updated, version mismatch (concurrent modification)
```

```typescript
async function updateProduct(id: string, data: Partial<Product>, expectedVersion: number) {
  const result = await db.query(
    `UPDATE products
     SET name = $1, price = $2, version = version + 1
     WHERE id = $3 AND version = $4
     RETURNING *`,
    [data.name, data.price, id, expectedVersion]
  );

  if (result.rowCount === 0) {
    throw new OptimisticLockError('Product was modified by another process');
  }

  return result.rows[0];
}
```

## Pagination Patterns

### Offset Pagination

```typescript
async function getUsers(page: number, limit: number) {
  const offset = (page - 1) * limit;

  const [users, countResult] = await Promise.all([
    db.query(
      'SELECT * FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    ),
    db.query('SELECT COUNT(*) FROM users'),
  ]);

  const total = parseInt(countResult.rows[0].count);

  return {
    data: users.rows,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}
```

### Cursor Pagination (Keyset)

```typescript
interface CursorPaginationResult<T> {
  data: T[];
  meta: {
    hasMore: boolean;
    nextCursor: string | null;
  };
}

async function getUsersCursor(cursor: string | null, limit: number) {
  let query = 'SELECT * FROM users WHERE 1=1';
  const params: any[] = [];

  if (cursor) {
    const { id, createdAt } = JSON.parse(Buffer.from(cursor, 'base64').toString());
    query += ` AND (created_at, id) < ($1, $2)`;
    params.push(createdAt, id);
  }

  query += ` ORDER BY created_at DESC, id DESC LIMIT $${params.length + 1}`;
  params.push(limit + 1); // Fetch one extra to check hasMore

  const result = await db.query(query, params);
  const users = result.rows;

  const hasMore = users.length > limit;
  if (hasMore) users.pop(); // Remove extra

  const lastUser = users[users.length - 1];
  const nextCursor = hasMore
    ? Buffer.from(JSON.stringify({
        id: lastUser.id,
        createdAt: lastUser.created_at,
      })).toString('base64')
    : null;

  return {
    data: users,
    meta: { hasMore, nextCursor },
  };
}
```

## Data Access Object (DAO) Pattern

```typescript
interface UserDAO {
  findById(id: string): Promise<UserEntity | null>;
  findByEmail(email: string): Promise<UserEntity | null>;
  save(user: UserEntity): Promise<UserEntity>;
  delete(id: string): Promise<void>;
}

class PostgresUserDAO implements UserDAO {
  constructor(private pool: Pool) {}

  async findById(id: string): Promise<UserEntity | null> {
    const result = await this.pool.query(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0] ? this.mapToEntity(result.rows[0]) : null;
  }

  async save(user: UserEntity): Promise<UserEntity> {
    const result = await this.pool.query(
      `INSERT INTO users (id, email, name)
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET
         email = EXCLUDED.email,
         name = EXCLUDED.name,
         updated_at = NOW()
       RETURNING *`,
      [user.id, user.email, user.name]
    );
    return this.mapToEntity(result.rows[0]);
  }

  private mapToEntity(row: any): UserEntity {
    return new UserEntity({
      id: row.id,
      email: row.email,
      name: row.name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }
}
```

## Transaction Patterns

```typescript
// Transaction wrapper
async function withTransaction<T>(
  db: Pool,
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await db.connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Usage
const result = await withTransaction(db, async (client) => {
  const user = await client.query(
    'INSERT INTO users (email) VALUES ($1) RETURNING *',
    ['test@example.com']
  );

  await client.query(
    'INSERT INTO profiles (user_id) VALUES ($1)',
    [user.rows[0].id]
  );

  return user.rows[0];
});
```

## Best Practices

### Query Optimization
- Use EXPLAIN ANALYZE to understand query plans
- Create indexes based on query patterns
- Avoid SELECT * - specify needed columns
- Use prepared statements for repeated queries

### Connection Management
- Use connection pooling
- Set appropriate pool sizes
- Handle connection timeouts
- Close connections properly

### Data Integrity
- Use transactions for related operations
- Implement optimistic/pessimistic locking
- Use constraints (FK, CHECK, UNIQUE)
- Validate data before writes
