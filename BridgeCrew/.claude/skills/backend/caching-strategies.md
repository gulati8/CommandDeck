# Caching Strategies

Patterns and best practices for implementing caching at various layers.

## Cache Patterns

### Cache-Aside (Lazy Loading)

```typescript
async function getUser(userId: string): Promise<User> {
  const cacheKey = `user:${userId}`;

  // Try cache first
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  // Cache miss - fetch from database
  const user = await db.query('SELECT * FROM users WHERE id = $1', [userId]);

  // Store in cache
  await redis.setex(cacheKey, 3600, JSON.stringify(user));

  return user;
}
```

**Pros**: Only caches what's needed, cache misses are handled gracefully
**Cons**: Cache miss penalty, potential for stale data

### Write-Through

```typescript
async function updateUser(userId: string, data: Partial<User>): Promise<User> {
  // Update database
  const user = await db.query(
    'UPDATE users SET name = $1 WHERE id = $2 RETURNING *',
    [data.name, userId]
  );

  // Update cache immediately
  const cacheKey = `user:${userId}`;
  await redis.setex(cacheKey, 3600, JSON.stringify(user));

  return user;
}
```

**Pros**: Cache always consistent with database
**Cons**: Higher write latency, cache churn for rarely-read data

### Write-Behind (Write-Back)

```typescript
class WriteBackCache {
  private writeQueue: Map<string, { data: any; timestamp: number }> = new Map();
  private flushInterval: NodeJS.Timer;

  constructor(private redis: Redis, private db: Database) {
    // Flush queue every 5 seconds
    this.flushInterval = setInterval(() => this.flush(), 5000);
  }

  async set(key: string, data: any): Promise<void> {
    // Update cache immediately
    await this.redis.setex(key, 3600, JSON.stringify(data));

    // Queue for database write
    this.writeQueue.set(key, { data, timestamp: Date.now() });
  }

  private async flush(): Promise<void> {
    const entries = Array.from(this.writeQueue.entries());
    this.writeQueue.clear();

    // Batch write to database
    for (const [key, { data }] of entries) {
      try {
        await this.db.upsert(key, data);
      } catch (error) {
        // Re-queue failed writes
        this.writeQueue.set(key, { data, timestamp: Date.now() });
      }
    }
  }
}
```

**Pros**: Low write latency, batched database writes
**Cons**: Data loss risk on crash, complexity

### Read-Through

```typescript
// Cache handles fetching from source
class ReadThroughCache<T> {
  constructor(
    private redis: Redis,
    private source: (key: string) => Promise<T>,
    private ttl: number = 3600
  ) {}

  async get(key: string): Promise<T | null> {
    const cached = await this.redis.get(key);
    if (cached) {
      return JSON.parse(cached);
    }

    const value = await this.source(key);
    if (value) {
      await this.redis.setex(key, this.ttl, JSON.stringify(value));
    }

    return value;
  }
}

// Usage
const userCache = new ReadThroughCache(
  redis,
  async (key) => {
    const userId = key.replace('user:', '');
    return db.query('SELECT * FROM users WHERE id = $1', [userId]);
  },
  3600
);

const user = await userCache.get(`user:${userId}`);
```

## Cache Invalidation Strategies

### Time-Based (TTL)

```typescript
// Simple TTL
await redis.setex('user:123', 3600, JSON.stringify(user)); // 1 hour

// Refresh TTL on access (sliding expiration)
async function getWithSlidingExpiry(key: string): Promise<any> {
  const value = await redis.get(key);
  if (value) {
    await redis.expire(key, 3600); // Reset TTL
    return JSON.parse(value);
  }
  return null;
}
```

### Event-Based Invalidation

```typescript
// Publish invalidation events
async function updateUser(userId: string, data: Partial<User>): Promise<User> {
  const user = await db.query('UPDATE users SET ... RETURNING *');

  // Publish event for cache invalidation
  await redis.publish('cache:invalidate', JSON.stringify({
    type: 'user',
    id: userId,
  }));

  return user;
}

// Subscribe to invalidation events
redis.subscribe('cache:invalidate', async (message) => {
  const { type, id } = JSON.parse(message);
  await redis.del(`${type}:${id}`);
});
```

### Version-Based Invalidation

```typescript
// Include version in cache key
async function getCachedData(key: string, version: number) {
  const versionedKey = `${key}:v${version}`;
  return redis.get(versionedKey);
}

// Increment version to invalidate all old cached data
async function invalidateAll() {
  await redis.incr('cache:version');
}
```

### Tag-Based Invalidation

```typescript
class TaggedCache {
  async set(key: string, value: any, tags: string[]): Promise<void> {
    // Store value
    await this.redis.setex(key, 3600, JSON.stringify(value));

    // Associate key with tags
    for (const tag of tags) {
      await this.redis.sadd(`tag:${tag}`, key);
    }
  }

  async invalidateByTag(tag: string): Promise<void> {
    const keys = await this.redis.smembers(`tag:${tag}`);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
    await this.redis.del(`tag:${tag}`);
  }
}

// Usage
await cache.set('user:123', userData, ['users', 'team:abc']);
await cache.set('user:456', userData, ['users', 'team:abc']);

// Invalidate all users in team
await cache.invalidateByTag('team:abc');
```

## Multi-Layer Caching

```
Request → L1 (Memory) → L2 (Redis) → Database
```

```typescript
class MultiLayerCache<T> {
  private l1Cache: Map<string, { value: T; expiry: number }> = new Map();

  constructor(
    private redis: Redis,
    private l1Ttl: number = 60000, // 1 minute
    private l2Ttl: number = 3600  // 1 hour
  ) {}

  async get(key: string): Promise<T | null> {
    // L1: In-memory
    const l1Entry = this.l1Cache.get(key);
    if (l1Entry && l1Entry.expiry > Date.now()) {
      return l1Entry.value;
    }

    // L2: Redis
    const l2Value = await this.redis.get(key);
    if (l2Value) {
      const parsed = JSON.parse(l2Value);
      this.setL1(key, parsed);
      return parsed;
    }

    return null;
  }

  async set(key: string, value: T): Promise<void> {
    // Set both layers
    this.setL1(key, value);
    await this.redis.setex(key, this.l2Ttl, JSON.stringify(value));
  }

  private setL1(key: string, value: T): void {
    this.l1Cache.set(key, {
      value,
      expiry: Date.now() + this.l1Ttl,
    });
  }
}
```

## HTTP Caching

### Cache-Control Headers

```typescript
// Static assets - cache forever (use content hash in filename)
app.use('/static', express.static('public', {
  maxAge: '1y',
  immutable: true,
}));

// API responses
app.get('/api/users/:id', async (req, res) => {
  const user = await getUser(req.params.id);

  res.set({
    'Cache-Control': 'private, max-age=60',
    'ETag': generateETag(user),
  });

  res.json(user);
});

// Conditional GET
app.get('/api/users/:id', async (req, res) => {
  const user = await getUser(req.params.id);
  const etag = generateETag(user);

  if (req.headers['if-none-match'] === etag) {
    return res.status(304).end();
  }

  res.set('ETag', etag);
  res.json(user);
});
```

### CDN Caching

```typescript
// Cache at CDN level
app.get('/api/public/content/:id', (req, res) => {
  res.set({
    'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    'Surrogate-Control': 'max-age=86400', // For CDN
    'Vary': 'Accept-Encoding',
  });

  res.json(content);
});

// Purge CDN cache
async function purgeContent(contentId: string) {
  await fetch(`${CDN_API}/purge`, {
    method: 'POST',
    body: JSON.stringify({ urls: [`/api/public/content/${contentId}`] }),
  });
}
```

## Cache Warming

```typescript
// Warm cache on startup
async function warmCache() {
  console.log('Warming cache...');

  // Popular users
  const popularUsers = await db.query(
    'SELECT * FROM users ORDER BY popularity DESC LIMIT 100'
  );

  for (const user of popularUsers) {
    await redis.setex(`user:${user.id}`, 3600, JSON.stringify(user));
  }

  // Config data
  const config = await db.query('SELECT * FROM config');
  await redis.setex('app:config', 86400, JSON.stringify(config));

  console.log('Cache warmed');
}

// Schedule periodic warming
setInterval(warmCache, 30 * 60 * 1000); // Every 30 minutes
```

## Cache Stampede Prevention

### Locking

```typescript
async function getWithLock(key: string, fetchFn: () => Promise<any>) {
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached);

  // Acquire lock
  const lockKey = `lock:${key}`;
  const acquired = await redis.set(lockKey, '1', 'NX', 'EX', 10);

  if (!acquired) {
    // Another process is fetching, wait and retry
    await sleep(100);
    return getWithLock(key, fetchFn);
  }

  try {
    const value = await fetchFn();
    await redis.setex(key, 3600, JSON.stringify(value));
    return value;
  } finally {
    await redis.del(lockKey);
  }
}
```

### Probabilistic Early Expiration

```typescript
async function getWithEarlyExpiry(
  key: string,
  fetchFn: () => Promise<any>,
  ttl: number = 3600,
  beta: number = 1
) {
  const data = await redis.get(key);
  if (data) {
    const { value, expiry, delta } = JSON.parse(data);
    const now = Date.now() / 1000;

    // Probabilistic early refresh
    const shouldRefresh = now - delta * beta * Math.log(Math.random()) >= expiry;

    if (!shouldRefresh) {
      return value;
    }
  }

  const start = Date.now();
  const value = await fetchFn();
  const delta = (Date.now() - start) / 1000;

  await redis.setex(key, ttl, JSON.stringify({
    value,
    expiry: Date.now() / 1000 + ttl,
    delta,
  }));

  return value;
}
```

## Best Practices

### Cache Key Design
- Use consistent naming: `{type}:{id}:{variant}`
- Include version if schema changes: `user:v2:123`
- Keep keys short but descriptive

### TTL Guidelines
| Data Type | TTL | Reason |
|-----------|-----|--------|
| Static config | 24h+ | Rarely changes |
| User sessions | 1h | Security |
| API responses | 1-5min | Freshness vs. load |
| Computed data | 1h | Expensive to compute |

### Monitoring
- Track hit/miss ratios
- Monitor memory usage
- Alert on high eviction rates
- Log cache errors

### Common Pitfalls
- Don't cache user-specific data in shared cache without proper keys
- Don't cache sensitive data without encryption
- Don't cache null values without considering thundering herd
- Don't forget to invalidate on updates
