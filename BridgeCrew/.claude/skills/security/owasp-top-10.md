# OWASP Top 10 Security Risks

The most critical web application security risks and how to prevent them.

## A01:2021 - Broken Access Control

### Vulnerability

Users can access resources or perform actions outside their intended permissions.

```typescript
// ❌ Bad: No authorization check
app.get('/api/users/:id/profile', async (req, res) => {
  const profile = await db.getProfile(req.params.id);
  res.json(profile);
});

// ✅ Good: Verify user can access this profile
app.get('/api/users/:id/profile', authenticate, async (req, res) => {
  const userId = req.params.id;

  // Check if user owns this profile or is admin
  if (req.user.id !== userId && !req.user.isAdmin) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const profile = await db.getProfile(userId);
  res.json(profile);
});
```

### Prevention

- Deny by default
- Implement attribute-based access control (ABAC)
- Disable directory listing
- Log access control failures
- Rate limit API access

```typescript
// RBAC Middleware
function requireRole(...roles: string[]) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    next();
  };
}

app.delete('/api/users/:id', requireRole('admin'), async (req, res) => {
  // Only admins can delete users
});
```

## A02:2021 - Cryptographic Failures

### Vulnerability

Sensitive data exposed due to weak or missing encryption.

```typescript
// ❌ Bad: Storing passwords in plaintext
await db.users.insert({
  email: user.email,
  password: user.password,
});

// ❌ Bad: Using weak hashing
const hash = crypto.createHash('md5').update(password).digest('hex');

// ✅ Good: Using bcrypt
import bcrypt from 'bcrypt';

const hashedPassword = await bcrypt.hash(password, 12);
await db.users.insert({
  email: user.email,
  password: hashedPassword,
});

// Verify password
const isValid = await bcrypt.compare(password, hashedPassword);
```

### Prevention

- Use strong encryption (AES-256)
- Hash passwords with bcrypt, Argon2, or PBKDF2
- Use HTTPS for all communications
- Don't store sensitive data unnecessarily
- Implement proper key management

```typescript
// Encrypt sensitive data
import crypto from 'crypto';

const algorithm = 'aes-256-gcm';
const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');

function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

function decrypt(encrypted: string): string {
  const [ivHex, authTagHex, encryptedText] = encrypted.split(':');

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv(algorithm, key, iv);

  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
```

## A03:2021 - Injection

### SQL Injection

```typescript
// ❌ Bad: String concatenation
const query = `SELECT * FROM users WHERE email = '${req.body.email}'`;
// Vulnerable to: ' OR '1'='1

// ✅ Good: Parameterized queries
const query = 'SELECT * FROM users WHERE email = ?';
const results = await db.query(query, [req.body.email]);

// ✅ Good: ORM with prepared statements
const user = await db.users.findOne({
  where: { email: req.body.email }
});
```

### Command Injection

```typescript
// ❌ Bad: Shell command with user input
const { exec } = require('child_process');
exec(`convert ${req.body.filename} output.png`);

// ✅ Good: Use libraries, validate input
import sharp from 'sharp';

const allowedFilenames = /^[a-zA-Z0-9_-]+\.(jpg|png|gif)$/;
if (!allowedFilenames.test(req.body.filename)) {
  throw new Error('Invalid filename');
}

await sharp(req.body.filename).toFile('output.png');
```

### NoSQL Injection

```typescript
// ❌ Bad: Direct object query
const user = await db.collection('users').findOne({
  email: req.body.email,
  password: req.body.password
});
// Vulnerable to: { password: { $ne: null } }

// ✅ Good: Validate and sanitize
import { isString } from 'validator';

if (!isString(req.body.email) || !isString(req.body.password)) {
  throw new Error('Invalid input');
}

const user = await db.collection('users').findOne({
  email: String(req.body.email)
});

if (user && await bcrypt.compare(req.body.password, user.password)) {
  // Valid login
}
```

## A04:2021 - Insecure Design

### Missing Rate Limiting

```typescript
// ✅ Add rate limiting
import rateLimit from 'express-rate-limit';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  message: 'Too many login attempts',
  standardHeaders: true,
  legacyHeaders: false,
});

app.post('/api/login', loginLimiter, async (req, res) => {
  // Login logic
});
```

### Missing Input Validation

```typescript
// ✅ Comprehensive validation
import { z } from 'zod';

const CreateUserSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(12).max(128)
    .regex(/[A-Z]/, 'Must contain uppercase')
    .regex(/[a-z]/, 'Must contain lowercase')
    .regex(/[0-9]/, 'Must contain number')
    .regex(/[^A-Za-z0-9]/, 'Must contain special char'),
  name: z.string().min(1).max(100),
  age: z.number().int().min(18).max(120).optional(),
});

app.post('/api/users', async (req, res) => {
  try {
    const data = CreateUserSchema.parse(req.body);
    // Process validated data
  } catch (error) {
    return res.status(400).json({ error: error.errors });
  }
});
```

## A05:2021 - Security Misconfiguration

### Secure Headers

```typescript
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));
```

### CORS Configuration

```typescript
import cors from 'cors';

// ❌ Bad: Allow all origins
app.use(cors({ origin: '*' }));

// ✅ Good: Whitelist specific origins
const allowedOrigins = [
  'https://example.com',
  'https://app.example.com',
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
```

## A06:2021 - Vulnerable and Outdated Components

### Dependency Management

```bash
# Check for vulnerabilities
npm audit
npm audit fix

# Use Snyk or Dependabot
npm install -g snyk
snyk test
snyk monitor
```

```yaml
# GitHub Dependabot (.github/dependabot.yml)
version: 2
updates:
  - package-ecosystem: npm
    directory: "/"
    schedule:
      interval: weekly
    open-pull-requests-limit: 10
```

## A07:2021 - Identification and Authentication Failures

### Session Management

```typescript
import session from 'express-session';
import RedisStore from 'connect-redis';

app.use(session({
  store: new RedisStore({ client: redisClient }),
  secret: process.env.SESSION_SECRET,
  name: 'sessionId', // Don't use default name
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true, // HTTPS only
    httpOnly: true, // No JS access
    maxAge: 1000 * 60 * 60 * 24, // 24 hours
    sameSite: 'strict',
  },
}));
```

### Multi-Factor Authentication

```typescript
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';

// Generate secret
const secret = speakeasy.generateSecret({
  name: `MyApp (${user.email})`,
});

// Generate QR code
const qrCode = await QRCode.toDataURL(secret.otpauth_url);

// Verify token
const verified = speakeasy.totp.verify({
  secret: user.totpSecret,
  encoding: 'base32',
  token: req.body.token,
  window: 2, // Allow 1 step before/after
});
```

## A08:2021 - Software and Data Integrity Failures

### Verify Package Integrity

```bash
# Use package lock
npm ci # Instead of npm install in CI

# Verify checksums
npm install --integrity
```

### Code Signing

```typescript
import crypto from 'crypto';

function verifySignature(data: string, signature: string, publicKey: string): boolean {
  const verify = crypto.createVerify('SHA256');
  verify.update(data);
  verify.end();

  return verify.verify(publicKey, signature, 'hex');
}
```

## A09:2021 - Security Logging and Monitoring Failures

### Comprehensive Logging

```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'api' },
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

// Log security events
logger.warn({
  event: 'login.failed',
  email: req.body.email,
  ip: req.ip,
  userAgent: req.headers['user-agent'],
});

logger.error({
  event: 'access.denied',
  userId: req.user?.id,
  resource: req.path,
  ip: req.ip,
});
```

## A10:2021 - Server-Side Request Forgery (SSRF)

### URL Validation

```typescript
import { URL } from 'url';

function isAllowedUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);

    // Only allow HTTPS
    if (url.protocol !== 'https:') {
      return false;
    }

    // Whitelist domains
    const allowedDomains = ['api.example.com', 'cdn.example.com'];
    if (!allowedDomains.includes(url.hostname)) {
      return false;
    }

    // Prevent private IPs
    const hostname = url.hostname;
    if (
      hostname === 'localhost' ||
      hostname.startsWith('127.') ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('172.')
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

app.post('/api/fetch', async (req, res) => {
  const url = req.body.url;

  if (!isAllowedUrl(url)) {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  const response = await fetch(url);
  res.json(await response.json());
});
```

## Best Practices

### Security Checklist

- [ ] All inputs validated and sanitized
- [ ] Parameterized queries for all database access
- [ ] Passwords hashed with bcrypt (12+ rounds)
- [ ] HTTPS enforced
- [ ] Security headers configured (Helmet)
- [ ] CORS properly restricted
- [ ] Rate limiting on authentication endpoints
- [ ] Session management secure
- [ ] Dependencies kept up to date
- [ ] Security logging implemented
- [ ] Regular security audits
- [ ] Principle of least privilege applied
