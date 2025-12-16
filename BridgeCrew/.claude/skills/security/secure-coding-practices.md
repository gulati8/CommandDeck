# Secure Coding Practices

Guidelines and patterns for writing secure code across all layers of the application.

## Input Validation

### Whitelist Approach

```typescript
// ❌ Bad: Blacklist approach (incomplete)
function sanitizeInput(input: string): string {
  return input.replace(/<script>/gi, '');
  // Attacker can use <scr<script>ipt>
}

// ✅ Good: Whitelist approach
import { z } from 'zod';

const UsernameSchema = z.string()
  .min(3)
  .max(20)
  .regex(/^[a-zA-Z0-9_]+$/, 'Only alphanumeric and underscore allowed');

function validateUsername(input: string): string {
  return UsernameSchema.parse(input);
}
```

### Context-Aware Validation

```typescript
// Different contexts require different validation
const validators = {
  email: z.string().email().max(255),

  url: z.string().url().max(2048).refine((url) => {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  }),

  filename: z.string()
    .max(255)
    .regex(/^[a-zA-Z0-9_.-]+$/),

  uuid: z.string().uuid(),

  integer: z.number().int().finite(),

  dateString: z.string().datetime(),
};
```

## Output Encoding

### HTML Escaping

```typescript
// ❌ Bad: Direct interpolation
function renderComment(comment: string): string {
  return `<div>${comment}</div>`;
  // Vulnerable to XSS
}

// ✅ Good: Escape HTML entities
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };
  return text.replace(/[&<>"'/]/g, (char) => map[char]);
}

function renderComment(comment: string): string {
  return `<div>${escapeHtml(comment)}</div>`;
}
```

### React/JSX Auto-Escaping

```tsx
// ✅ React escapes by default
function Comment({ text }: { text: string }) {
  return <div>{text}</div>; // Automatically escaped
}

// ❌ Dangerous: Using dangerouslySetInnerHTML
function Comment({ html }: { html: string }) {
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}

// ✅ Use DOMPurify for HTML content
import DOMPurify from 'dompurify';

function SafeHTMLComment({ html }: { html: string }) {
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'b', 'i', 'em', 'strong', 'a'],
    ALLOWED_ATTR: ['href'],
  });
  return <div dangerouslySetInnerHTML={{ __html: clean }} />;
}
```

### URL Encoding

```typescript
// ✅ Properly encode URL parameters
const searchQuery = 'user@example.com';
const url = `/search?q=${encodeURIComponent(searchQuery)}`;

// ✅ Use URLSearchParams for complex queries
const params = new URLSearchParams({
  query: 'hello world',
  filter: 'active',
  sort: 'date',
});
const url = `/search?${params.toString()}`;
```

## Authentication Security

### Password Requirements

```typescript
import { z } from 'zod';

const PasswordSchema = z.string()
  .min(12, 'Password must be at least 12 characters')
  .max(128, 'Password must be less than 128 characters')
  .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Must contain at least one special character')
  .refine(
    (password) => {
      // Check against common passwords
      const common = ['Password123!', 'Welcome123!', 'Admin123!'];
      return !common.includes(password);
    },
    'Password is too common'
  );
```

### Secure Password Storage

```typescript
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ✅ Good: Store hash, never plaintext
async function createUser(email: string, password: string) {
  const passwordHash = await hashPassword(password);

  await db.users.insert({
    email,
    password_hash: passwordHash, // Store hash
    // Never store plaintext password
  });
}
```

### Token Security

```typescript
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// ✅ Use strong secrets
const JWT_SECRET = process.env.JWT_SECRET; // At least 256 bits
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters');
}

// ✅ Short expiration times
function createAccessToken(userId: string): string {
  return jwt.sign(
    { userId, type: 'access' },
    JWT_SECRET,
    { expiresIn: '15m' }
  );
}

function createRefreshToken(userId: string): string {
  return jwt.sign(
    { userId, type: 'refresh' },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// ✅ Verify token type
function verifyAccessToken(token: string): { userId: string } {
  const payload = jwt.verify(token, JWT_SECRET) as any;

  if (payload.type !== 'access') {
    throw new Error('Invalid token type');
  }

  return { userId: payload.userId };
}
```

## Authorization Patterns

### Role-Based Access Control

```typescript
type Role = 'admin' | 'editor' | 'viewer';

interface User {
  id: string;
  email: string;
  role: Role;
}

const permissions = {
  admin: ['read', 'write', 'delete', 'manage'],
  editor: ['read', 'write'],
  viewer: ['read'],
};

function hasPermission(user: User, action: string): boolean {
  return permissions[user.role].includes(action);
}

// Middleware
function requirePermission(action: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !hasPermission(req.user, action)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

app.delete('/api/posts/:id', requirePermission('delete'), async (req, res) => {
  // Only users with delete permission can access
});
```

### Resource-Level Authorization

```typescript
// ✅ Check resource ownership
async function getPost(postId: string, userId: string): Promise<Post> {
  const post = await db.posts.findOne({ id: postId });

  if (!post) {
    throw new NotFoundError('Post not found');
  }

  // Check if user owns the post or is admin
  const user = await db.users.findOne({ id: userId });

  if (post.authorId !== userId && user.role !== 'admin') {
    throw new ForbiddenError('Cannot access this post');
  }

  return post;
}
```

## Error Handling

### Don't Leak Information

```typescript
// ❌ Bad: Exposes stack trace and database details
app.get('/api/users/:id', async (req, res) => {
  try {
    const user = await db.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

// ✅ Good: Generic error message
app.get('/api/users/:id', async (req, res) => {
  try {
    const user = await db.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
    res.json(user);
  } catch (error) {
    logger.error({ error, userId: req.params.id }, 'Failed to fetch user');
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

### Consistent Error Responses

```typescript
class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code: string
  ) {
    super(message);
  }
}

class NotFoundError extends AppError {
  constructor(message: string) {
    super(404, message, 'NOT_FOUND');
  }
}

class ForbiddenError extends AppError {
  constructor(message: string) {
    super(403, message, 'FORBIDDEN');
  }
}

// Error handler middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
      },
    });
  }

  // Log unexpected errors
  logger.error({ err, req: { method: req.method, url: req.url } });

  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  });
});
```

## Secure File Handling

### File Upload Validation

```typescript
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';

const allowedMimeTypes = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'application/pdf',
];

const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    // Generate random filename
    const randomName = crypto.randomBytes(16).toString('hex');
    const ext = path.extname(file.originalname);
    cb(null, `${randomName}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (req, file, cb) => {
    // Validate MIME type
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return cb(new Error('Invalid file type'));
    }

    // Validate extension
    const ext = path.extname(file.originalname).toLowerCase();
    if (!['.jpg', '.jpeg', '.png', '.gif', '.pdf'].includes(ext)) {
      return cb(new Error('Invalid file extension'));
    }

    cb(null, true);
  },
});

app.post('/api/upload', upload.single('file'), async (req, res) => {
  // Additional validation with file-type library
  const fileType = await import('file-type');
  const type = await fileType.fromFile(req.file.path);

  if (!type || !allowedMimeTypes.includes(type.mime)) {
    // Delete file
    await fs.unlink(req.file.path);
    return res.status(400).json({ error: 'Invalid file type' });
  }

  res.json({ filename: req.file.filename });
});
```

### Path Traversal Prevention

```typescript
import path from 'path';

// ❌ Bad: Vulnerable to path traversal
app.get('/files/:filename', (req, res) => {
  const filePath = `./uploads/${req.params.filename}`;
  res.sendFile(filePath);
  // Attacker can use: ../../../../etc/passwd
});

// ✅ Good: Validate path
app.get('/files/:filename', (req, res) => {
  const filename = path.basename(req.params.filename);
  const uploadsDir = path.resolve('./uploads');
  const filePath = path.join(uploadsDir, filename);

  // Ensure file is within uploads directory
  if (!filePath.startsWith(uploadsDir)) {
    return res.status(400).json({ error: 'Invalid path' });
  }

  res.sendFile(filePath);
});
```

## API Security

### Rate Limiting

```typescript
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';

// General API rate limit
const apiLimiter = rateLimit({
  store: new RedisStore({ client: redisClient }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many requests',
      retryAfter: req.rateLimit.resetTime,
    });
  },
});

// Stricter limit for sensitive endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true, // Don't count successful logins
});

app.use('/api/', apiLimiter);
app.post('/api/login', authLimiter, loginHandler);
```

### Request Size Limiting

```typescript
import express from 'express';

app.use(express.json({
  limit: '10kb', // Limit request body size
}));

// Specific limits for file uploads
app.post('/api/upload', express.json({ limit: '50mb' }), uploadHandler);
```

## Database Security

### Parameterized Queries

```typescript
// ❌ Never do this
const email = req.body.email;
const query = `SELECT * FROM users WHERE email = '${email}'`;
await db.query(query);

// ✅ Always use parameterized queries
const query = 'SELECT * FROM users WHERE email = $1';
await db.query(query, [req.body.email]);

// ✅ Use ORM/Query Builder
const user = await db('users')
  .where({ email: req.body.email })
  .first();
```

### Least Privilege

```sql
-- Create separate database users with minimal permissions

-- Read-only user for reporting
CREATE USER reporting_user WITH PASSWORD 'strong_password';
GRANT SELECT ON ALL TABLES IN SCHEMA public TO reporting_user;

-- Application user with limited permissions
CREATE USER app_user WITH PASSWORD 'strong_password';
GRANT SELECT, INSERT, UPDATE ON specific_tables TO app_user;
-- Do not grant DELETE or TRUNCATE unless necessary
```

## Logging Security

### What to Log

```typescript
// ✅ Log security events
logger.info({
  event: 'user.login',
  userId: user.id,
  ip: req.ip,
  userAgent: req.headers['user-agent'],
});

logger.warn({
  event: 'login.failed',
  email: req.body.email,
  ip: req.ip,
  reason: 'invalid_password',
});

logger.error({
  event: 'access.denied',
  userId: req.user?.id,
  resource: req.path,
  ip: req.ip,
});
```

### What NOT to Log

```typescript
// ❌ Never log sensitive data
logger.info({ password: req.body.password }); // NO!
logger.info({ creditCard: user.creditCard }); // NO!
logger.info({ ssn: user.ssn }); // NO!

// ✅ Redact sensitive data
function redactSensitiveData(obj: any): any {
  const sensitive = ['password', 'token', 'secret', 'creditCard', 'ssn'];
  const redacted = { ...obj };

  for (const key of Object.keys(redacted)) {
    if (sensitive.some(s => key.toLowerCase().includes(s))) {
      redacted[key] = '[REDACTED]';
    }
  }

  return redacted;
}

logger.info(redactSensitiveData(req.body));
```

## Best Practices

### Security Checklist

- [ ] All user input validated with whitelist approach
- [ ] Output properly encoded for context (HTML, URL, SQL)
- [ ] Passwords hashed with bcrypt (12+ rounds)
- [ ] Authentication tokens short-lived
- [ ] Authorization checked on every request
- [ ] Error messages don't leak information
- [ ] File uploads validated (type, size, content)
- [ ] Path traversal prevented
- [ ] Rate limiting on all endpoints
- [ ] Database queries parameterized
- [ ] Least privilege database access
- [ ] Security events logged
- [ ] Sensitive data never logged
- [ ] HTTPS enforced
- [ ] Security headers configured
