# Database Architecture Templates and Patterns

Reference templates for database schema design, migrations, indexing strategies, and query optimization. Use these as starting points, adapting to project requirements.

---

## Schema Design Template

### Table Example

**Table: users**
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE -- Soft delete

  -- Constraints
  CONSTRAINT email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Indexes
CREATE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_created_at ON users(created_at);
```

---

## Common Schema Patterns

### Soft Deletes
```sql
deleted_at TIMESTAMP WITH TIME ZONE
-- Always filter: WHERE deleted_at IS NULL
-- Partial index: CREATE INDEX ... WHERE deleted_at IS NULL
```

### Audit Columns
```sql
created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
created_by UUID REFERENCES users(id),
updated_by UUID REFERENCES users(id)
```

### Multi-tenancy
```sql
tenant_id UUID NOT NULL REFERENCES tenants(id),
-- Row-level security or application-level filtering
-- Always include tenant_id in WHERE clauses
```

### Optimistic Locking (Versioning)
```sql
version INTEGER NOT NULL DEFAULT 1,
-- Optimistic locking: UPDATE ... WHERE version = $expected
```

---

## Indexing Strategy

### Index Selection Guide

| Query Pattern | Index Type |
|--------------|------------|
| Equality (=) | B-tree |
| Range (<, >, BETWEEN) | B-tree |
| Pattern (LIKE 'abc%') | B-tree |
| Pattern (LIKE '%abc%') | Full-text or trigram |
| Array contains | GIN |
| JSON containment | GIN |
| Geospatial | GiST or SP-GiST |
| Multiple columns (AND) | Composite B-tree |
| Multiple columns (OR) | Separate indexes |

### Example Indexes

#### Partial Indexes
```sql
-- Index only active records for frequent queries
CREATE INDEX idx_orders_active ON orders(status)
WHERE status IN ('pending', 'processing');
```

#### Composite Indexes
```sql
-- For queries with user_id AND created_at
CREATE INDEX idx_orders_user_created ON orders(user_id, created_at);
```

---

## Query Optimization

### Before and After Example

#### Problematic Query
```sql
-- BEFORE: Full table scan, 2.5s
SELECT * FROM orders
WHERE user_id = $1
ORDER BY created_at DESC;
```

#### Optimized Query
```sql
-- AFTER: Index scan, 15ms
SELECT id, status, total, created_at
FROM orders
WHERE user_id = $1
  AND deleted_at IS NULL
ORDER BY created_at DESC
LIMIT 50;
```

**Optimizations Applied**:
1. Added composite index on (user_id, created_at)
2. Selected only needed columns
3. Added LIMIT for pagination
4. Filtered soft-deleted records

### Execution Plan Analysis
```
Index Scan using idx_orders_user_created on orders
  Index Cond: (user_id = $1)
  Rows: 50
  Time: 15ms
```

---

## Migration Strategy

### Phase 1: Non-Breaking Changes
```sql
-- Add new columns with defaults
ALTER TABLE users ADD COLUMN status VARCHAR(20) DEFAULT 'active';
ALTER TABLE users ADD COLUMN metadata JSONB DEFAULT '{}';
```

### Phase 2: Data Migration
```sql
-- Backfill data (run in batches)
UPDATE users
SET status = CASE
  WHEN deleted_at IS NOT NULL THEN 'deleted'
  ELSE 'active'
END
WHERE status IS NULL
LIMIT 10000;
```

### Phase 3: Breaking Changes
```sql
-- Rename column (requires app update)
ALTER TABLE users RENAME COLUMN old_name TO new_name;
```

### Rollback Plan
```sql
-- If needed, revert Phase 1
ALTER TABLE users DROP COLUMN status;
ALTER TABLE users DROP COLUMN metadata;
```

---

## Data Integrity

### Referential Integrity
```sql
-- Prevent orphaned records
ALTER TABLE orders
ADD CONSTRAINT fk_orders_user
FOREIGN KEY (user_id) REFERENCES users(id)
ON DELETE RESTRICT;
```

### Audit Trail
```sql
-- Automatic updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
```

---

## Performance Considerations

### Read Optimization
- **Connection pooling**: PgBouncer with 50 connections
- **Query caching**: Redis for frequently accessed data
- **Read replicas**: Route read queries to replicas

### Write Optimization
- **Batch inserts**: Use COPY or multi-value INSERT
- **Async processing**: Queue heavy writes
- **Partial indexes**: Only index active records

### Scaling Strategy
| Data Size | Strategy |
|-----------|----------|
| < 10GB | Single primary |
| 10-100GB | Read replicas |
| 100GB-1TB | Table partitioning |
| > 1TB | Sharding by tenant |

---

## Monitoring Recommendations

### Key Metrics to Track
- Query execution time (p50, p95, p99)
- Index hit ratio (target: >99%)
- Table bloat percentage
- Connection count and wait time
- Replication lag (if using replicas)

### Alerts to Configure
- Query time > 1s
- Index hit ratio < 95%
- Connection count > 80% of max
- Replication lag > 30s

---

## Query Anti-Patterns to Avoid

### ❌ SELECT *
```sql
-- Bad: Fetches unnecessary data
SELECT * FROM users;

-- Good: Select only needed columns
SELECT id, email, name FROM users;
```

### ❌ N+1 Queries
```sql
-- Bad: One query per user
FOR user IN users:
  SELECT * FROM orders WHERE user_id = user.id;

-- Good: Single query with JOIN
SELECT u.*, o.*
FROM users u
LEFT JOIN orders o ON o.user_id = u.id;
```

### ❌ Functions on Indexed Columns
```sql
-- Bad: Can't use index
WHERE LOWER(email) = 'test@example.com';

-- Good: Store lowercase or use expression index
WHERE email = 'test@example.com';
-- Or: CREATE INDEX idx_users_email_lower ON users(LOWER(email));
```

---

## Design Principles

1. **Normalize first, denormalize for performance** - Start with 3NF, denormalize only when measured
2. **Index based on queries** - Analyze actual query patterns before creating indexes
3. **Constraints are documentation** - Use them to enforce business rules
4. **Plan for growth** - Design for 10x current scale
5. **Migrations must be reversible** - Always have a rollback plan
6. **Measure before optimizing** - Use EXPLAIN ANALYZE to verify improvements
7. **Consider write amplification** - More indexes = slower writes
8. **Use appropriate data types** - UUID vs. BIGSERIAL, VARCHAR vs. TEXT
9. **Document schema decisions** - Future developers need context
10. **Test with realistic data** - Performance varies with data volume
