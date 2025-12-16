# Authentication Patterns

Best practices for implementing authentication and authorization.

## JWT Authentication

### Token Structure

```
Header.Payload.Signature

# Header
{
  "alg": "RS256",
  "typ": "JWT"
}

# Payload
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "roles": ["user"],
  "iat": 1673784600,
  "exp": 1673788200
}
```

### Implementation

```typescript
// Generate token
import jwt from 'jsonwebtoken';

function generateTokens(user: User) {
  const accessToken = jwt.sign(
    {
      sub: user.id,
      email: user.email,
      roles: user.roles,
    },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );

  const refreshToken = jwt.sign(
    { sub: user.id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );

  return { accessToken, refreshToken };
}

// Verify token
function verifyToken(token: string) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError('Token expired');
    }
    throw new UnauthorizedError('Invalid token');
  }
}

// Middleware
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  try {
    req.user = verifyToken(token);
    next();
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
}
```

### Token Refresh Flow

```typescript
// Refresh endpoint
app.post('/auth/refresh', async (req, res) => {
  const { refreshToken } = req.body;

  try {
    // Verify refresh token
    const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    // Check if token is revoked (stored in Redis/DB)
    const isRevoked = await redis.get(`revoked:${refreshToken}`);
    if (isRevoked) {
      return res.status(401).json({ error: 'Token revoked' });
    }

    // Get user and generate new tokens
    const user = await User.findById(payload.sub);
    const tokens = generateTokens(user);

    // Optionally revoke old refresh token
    await redis.setex(`revoked:${refreshToken}`, 86400, '1');

    res.json(tokens);
  } catch (error) {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});
```

## OAuth 2.0 / OIDC

### Authorization Code Flow

```
1. User clicks "Login with Google"
2. Redirect to: https://accounts.google.com/oauth/authorize
   ?client_id=CLIENT_ID
   &redirect_uri=https://app.com/callback
   &response_type=code
   &scope=openid email profile
   &state=random_string

3. User authenticates with Google
4. Redirect back: https://app.com/callback?code=AUTH_CODE&state=random_string

5. Exchange code for tokens:
   POST https://oauth2.googleapis.com/token
   {
     client_id: CLIENT_ID,
     client_secret: CLIENT_SECRET,
     code: AUTH_CODE,
     redirect_uri: https://app.com/callback,
     grant_type: authorization_code
   }

6. Receive: { access_token, refresh_token, id_token }
```

### Implementation

```typescript
// OAuth callback handler
app.get('/auth/callback/google', async (req, res) => {
  const { code, state } = req.query;

  // Verify state to prevent CSRF
  if (state !== req.session.oauthState) {
    return res.status(400).json({ error: 'Invalid state' });
  }

  // Exchange code for tokens
  const { data } = await axios.post('https://oauth2.googleapis.com/token', {
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    code,
    redirect_uri: `${process.env.APP_URL}/auth/callback/google`,
    grant_type: 'authorization_code',
  });

  // Decode ID token to get user info
  const userInfo = jwt.decode(data.id_token);

  // Find or create user
  let user = await User.findOne({ email: userInfo.email });
  if (!user) {
    user = await User.create({
      email: userInfo.email,
      name: userInfo.name,
      googleId: userInfo.sub,
    });
  }

  // Generate app tokens
  const tokens = generateTokens(user);
  res.redirect(`/login-success?token=${tokens.accessToken}`);
});
```

## Session-Based Authentication

```typescript
import session from 'express-session';
import RedisStore from 'connect-redis';
import { createClient } from 'redis';

// Redis client
const redisClient = createClient({ url: process.env.REDIS_URL });
await redisClient.connect();

// Session middleware
app.use(session({
  store: new RedisStore({ client: redisClient }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'strict',
  },
}));

// Login
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });

  if (!user || !await bcrypt.compare(password, user.password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  req.session.userId = user.id;
  res.json({ user: { id: user.id, email: user.email } });
});

// Logout
app.post('/logout', (req, res) => {
  req.session.destroy();
  res.clearCookie('connect.sid');
  res.json({ success: true });
});
```

## API Key Authentication

```typescript
// Generate API key
function generateApiKey(): string {
  return `sk_live_${crypto.randomBytes(32).toString('hex')}`;
}

// Store hashed key
async function createApiKey(userId: string, name: string) {
  const key = generateApiKey();
  const hashedKey = await bcrypt.hash(key, 10);

  await ApiKey.create({
    userId,
    name,
    keyHash: hashedKey,
    prefix: key.slice(0, 12), // Store prefix for identification
    lastUsed: null,
  });

  // Return key only once - user must save it
  return key;
}

// Verify API key
async function verifyApiKey(key: string) {
  const prefix = key.slice(0, 12);
  const apiKey = await ApiKey.findOne({ prefix });

  if (!apiKey) return null;

  const valid = await bcrypt.compare(key, apiKey.keyHash);
  if (!valid) return null;

  // Update last used
  apiKey.lastUsed = new Date();
  await apiKey.save();

  return apiKey;
}

// Middleware
async function authenticateApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey) {
    return res.status(401).json({ error: 'API key required' });
  }

  const key = await verifyApiKey(apiKey);
  if (!key) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  req.apiKey = key;
  next();
}
```

## Authorization (RBAC)

```typescript
// Role definitions
const ROLES = {
  admin: ['read', 'write', 'delete', 'manage_users'],
  editor: ['read', 'write'],
  viewer: ['read'],
};

// Permission check middleware
function requirePermission(permission: string) {
  return (req, res, next) => {
    const userRoles = req.user.roles;
    const hasPermission = userRoles.some(role =>
      ROLES[role]?.includes(permission)
    );

    if (!hasPermission) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
}

// Usage
app.delete('/users/:id',
  authenticate,
  requirePermission('delete'),
  deleteUser
);
```

## Password Handling

```typescript
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;

// Hash password
async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

// Verify password
async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Password validation rules
function validatePassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (password.length < 8) errors.push('At least 8 characters');
  if (!/[A-Z]/.test(password)) errors.push('At least one uppercase letter');
  if (!/[a-z]/.test(password)) errors.push('At least one lowercase letter');
  if (!/[0-9]/.test(password)) errors.push('At least one number');
  if (!/[^A-Za-z0-9]/.test(password)) errors.push('At least one special character');

  return { valid: errors.length === 0, errors };
}
```

## Multi-Factor Authentication

```typescript
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';

// Enable MFA
async function enableMfa(userId: string) {
  const secret = speakeasy.generateSecret({
    name: `MyApp:${user.email}`,
    issuer: 'MyApp',
  });

  // Store secret (encrypted)
  await User.updateOne(
    { _id: userId },
    { mfaSecret: encrypt(secret.base32), mfaEnabled: false }
  );

  // Generate QR code for authenticator app
  const qrCode = await QRCode.toDataURL(secret.otpauth_url);

  return { secret: secret.base32, qrCode };
}

// Verify MFA token
function verifyMfaToken(secret: string, token: string): boolean {
  return speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token,
    window: 1, // Allow 1 step before/after
  });
}

// Login with MFA
app.post('/login', async (req, res) => {
  const { email, password, mfaToken } = req.body;
  const user = await User.findOne({ email });

  // Verify password
  if (!await verifyPassword(password, user.password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Check MFA if enabled
  if (user.mfaEnabled) {
    if (!mfaToken) {
      return res.status(401).json({ error: 'MFA token required', mfaRequired: true });
    }

    const secret = decrypt(user.mfaSecret);
    if (!verifyMfaToken(secret, mfaToken)) {
      return res.status(401).json({ error: 'Invalid MFA token' });
    }
  }

  const tokens = generateTokens(user);
  res.json(tokens);
});
```

## Security Best Practices

### Token Security
- Use short-lived access tokens (15 min)
- Store refresh tokens securely (httpOnly cookies)
- Implement token revocation
- Use RS256 for JWT signing in distributed systems

### Password Security
- Use bcrypt with cost factor 12+
- Enforce strong password policies
- Implement rate limiting on login
- Use secure password reset flows

### Session Security
- Use secure, httpOnly, sameSite cookies
- Regenerate session ID after login
- Implement session timeout
- Store sessions in secure backend (Redis)

### General
- Always use HTTPS
- Implement CSRF protection
- Log authentication events
- Implement account lockout after failed attempts
