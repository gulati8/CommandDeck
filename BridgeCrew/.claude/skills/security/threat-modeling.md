# Threat Modeling

Systematic approach to identifying, evaluating, and mitigating security threats in software systems.

## STRIDE Framework

STRIDE is a threat modeling framework that categorizes threats into six types:

- **S**poofing - Pretending to be someone else
- **T**ampering - Modifying data or code
- **R**epudiation - Denying actions
- **I**nformation Disclosure - Exposing information
- **D**enial of Service - Making system unavailable
- **E**levation of Privilege - Gaining unauthorized access

## Threat Modeling Process

```
1. Identify Assets
   ↓
2. Create Architecture Diagrams
   ↓
3. Identify Threats (STRIDE)
   ↓
4. Assess Risk (Likelihood × Impact)
   ↓
5. Define Mitigations
   ↓
6. Validate and Test
```

## Example: Web Application Threat Model

### 1. System Architecture

```
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │ HTTPS
       ↓
┌──────────────────┐
│   Load Balancer  │
└──────┬───────────┘
       │
       ↓
┌──────────────────┐       ┌─────────────┐
│   Web Server     │←──────│   Redis     │
│   (Node.js)      │       │   (Cache)   │
└──────┬───────────┘       └─────────────┘
       │
       ↓
┌──────────────────┐
│   PostgreSQL     │
│   (Database)     │
└──────────────────┘
```

### 2. Trust Boundaries

```
┌────────────────────────────────────────┐
│         External (Untrusted)           │
│  ┌──────────────────────────────────┐  │
│  │    Browser / Client              │  │
│  └──────────────────────────────────┘  │
└────────────────────────────────────────┘
                  ↓
┌────────────────────────────────────────┐
│            DMZ (Semi-Trusted)          │
│  ┌──────────────────────────────────┐  │
│  │   Load Balancer                  │  │
│  └──────────────────────────────────┘  │
└────────────────────────────────────────┘
                  ↓
┌────────────────────────────────────────┐
│        Internal (Trusted)              │
│  ┌──────────────────────────────────┐  │
│  │   Web Servers                    │  │
│  │   Cache                          │  │
│  │   Database                       │  │
│  └──────────────────────────────────┘  │
└────────────────────────────────────────┘
```

### 3. Threat Analysis by Component

#### Browser → Load Balancer

| Threat Type | Threat | Likelihood | Impact | Mitigation |
|-------------|--------|------------|--------|------------|
| Spoofing | Attacker impersonates user | High | High | Implement strong authentication (MFA) |
| Tampering | Request modification (MITM) | Medium | High | Enforce HTTPS with HSTS |
| Information Disclosure | Session token exposed | Medium | High | HttpOnly, Secure cookies |
| Denial of Service | DDoS attack | High | High | Rate limiting, CDN protection |

#### Load Balancer → Web Server

| Threat Type | Threat | Likelihood | Impact | Mitigation |
|-------------|--------|------------|--------|------------|
| Spoofing | Rogue web server | Low | High | Mutual TLS, certificate pinning |
| Tampering | Modified requests | Low | Medium | Internal network isolation |
| Information Disclosure | Traffic sniffing | Low | Medium | Encrypted internal traffic |

#### Web Server → Database

| Threat Type | Threat | Likelihood | Impact | Mitigation |
|-------------|--------|------------|--------|------------|
| Injection | SQL injection | High | Critical | Parameterized queries, ORM |
| Information Disclosure | Credential exposure | Medium | Critical | Secret management, encryption |
| Elevation of Privilege | Excessive DB permissions | Medium | High | Least privilege principle |
| Denial of Service | Resource exhaustion | Medium | High | Connection pooling, query timeouts |

### 4. Authentication Flow Threats

```typescript
// Authentication threat model
interface AuthThreat {
  step: string;
  threats: {
    type: keyof typeof STRIDE;
    description: string;
    mitigation: string;
  }[];
}

const authThreats: AuthThreat[] = [
  {
    step: 'Login form submission',
    threats: [
      {
        type: 'Tampering',
        description: 'Credentials intercepted in transit',
        mitigation: 'Enforce HTTPS, HSTS headers',
      },
      {
        type: 'Spoofing',
        description: 'Phishing attack',
        mitigation: 'User education, 2FA, anti-phishing tokens',
      },
      {
        type: 'Denial of Service',
        description: 'Brute force attack',
        mitigation: 'Rate limiting, account lockout, CAPTCHA',
      },
    ],
  },
  {
    step: 'Password verification',
    threats: [
      {
        type: 'Information Disclosure',
        description: 'Timing attack reveals valid usernames',
        mitigation: 'Constant-time comparison, generic error messages',
      },
      {
        type: 'Tampering',
        description: 'Database compromise exposes passwords',
        mitigation: 'Hash passwords with bcrypt (12+ rounds)',
      },
    ],
  },
  {
    step: 'Session creation',
    threats: [
      {
        type: 'Information Disclosure',
        description: 'Session token stolen (XSS)',
        mitigation: 'HttpOnly cookies, CSP headers',
      },
      {
        type: 'Spoofing',
        description: 'Session fixation',
        mitigation: 'Regenerate session ID after login',
      },
      {
        type: 'Repudiation',
        description: 'User denies login',
        mitigation: 'Log authentication events with IP, timestamp',
      },
    ],
  },
];
```

## Attack Trees

### Goal: Gain Admin Access

```
                    Gain Admin Access
                           |
        ┌──────────────────┼──────────────────┐
        │                  │                  │
   Steal Admin       Exploit Vuln      Social Engineer
   Credentials           |                   Admin
        |                │                    |
    ┌───┴───┐       ┌────┴────┐          ┌───┴───┐
    │       │       │         │          │       │
  Phish  Keylog  SQLi  Privilege    Pretend  Bribe
  Admin          Attack  Escalation   Support
```

### Calculating Risk

```typescript
type Likelihood = 'low' | 'medium' | 'high';
type Impact = 'low' | 'medium' | 'high' | 'critical';

interface Threat {
  name: string;
  likelihood: Likelihood;
  impact: Impact;
  description: string;
  mitigation: string;
  cost: number; // Cost to implement mitigation
}

const likelihoodScores = { low: 1, medium: 2, high: 3 };
const impactScores = { low: 1, medium: 2, high: 3, critical: 4 };

function calculateRisk(threat: Threat): number {
  return likelihoodScores[threat.likelihood] * impactScores[threat.impact];
}

function prioritizeThreats(threats: Threat[]): Threat[] {
  return threats
    .map(threat => ({
      ...threat,
      risk: calculateRisk(threat),
      roi: calculateRisk(threat) / threat.cost, // Return on investment
    }))
    .sort((a, b) => b.roi - a.roi);
}

// Example threats
const threats: Threat[] = [
  {
    name: 'SQL Injection',
    likelihood: 'high',
    impact: 'critical',
    description: 'Attacker can execute arbitrary SQL',
    mitigation: 'Use parameterized queries',
    cost: 2, // Low cost: refactor queries
  },
  {
    name: 'DDoS Attack',
    likelihood: 'high',
    impact: 'high',
    description: 'Service unavailable',
    mitigation: 'Implement rate limiting and CDN',
    cost: 5, // Medium cost: infrastructure changes
  },
  {
    name: 'Physical Server Access',
    likelihood: 'low',
    impact: 'critical',
    description: 'Attacker gains physical access',
    mitigation: 'Enhanced physical security',
    cost: 10, // High cost: physical controls
  },
];

const prioritized = prioritizeThreats(threats);
// Focus on high ROI mitigations first
```

## Data Flow Diagram (DFD)

### User Registration Flow

```
┌─────────┐
│  User   │
└────┬────┘
     │ 1. Registration Data
     ↓
┌─────────────────────┐
│   Web Application   │──→ Threat: Data tampering in transit
└──────┬──────────────┘    Mitigation: HTTPS, input validation
       │
       │ 2. Validate Input
       ↓
┌─────────────────────┐
│  Validation Logic   │──→ Threat: Injection attacks
└──────┬──────────────┘    Mitigation: Whitelist validation, sanitization
       │
       │ 3. Hash Password
       ↓
┌─────────────────────┐
│  Password Hasher    │──→ Threat: Weak hashing
└──────┬──────────────┘    Mitigation: bcrypt with 12+ rounds
       │
       │ 4. Store User
       ↓
┌─────────────────────┐
│     Database        │──→ Threat: SQL injection, credential theft
└─────────────────────┘    Mitigation: Parameterized queries, encrypted connections
```

## Common Threat Scenarios

### Scenario 1: API Endpoint

```typescript
// Endpoint: GET /api/users/:id/orders
// Threat model:

interface EndpointThreat {
  component: string;
  threats: string[];
}

const apiThreats: EndpointThreat[] = [
  {
    component: 'Authentication',
    threats: [
      'Missing authentication - anyone can access',
      'Stolen tokens - session hijacking',
      'Expired tokens not rejected',
    ],
  },
  {
    component: 'Authorization',
    threats: [
      'Horizontal privilege escalation - access other users orders',
      'Vertical privilege escalation - access admin functions',
      'IDOR - manipulate user ID to access others data',
    ],
  },
  {
    component: 'Input Validation',
    threats: [
      'SQL injection via user ID',
      'NoSQL injection',
      'Path traversal',
    ],
  },
  {
    component: 'Rate Limiting',
    threats: [
      'Brute force enumeration of user IDs',
      'DoS via excessive requests',
    ],
  },
  {
    component: 'Response',
    threats: [
      'Information leakage - exposing sensitive data',
      'Timing attacks - revealing if user exists',
    ],
  },
];

// Mitigated implementation
app.get(
  '/api/users/:id/orders',
  authenticate, // Verify JWT token
  rateLimiter, // Limit to 100 requests/hour
  async (req, res) => {
    // Authorization: Check user owns this resource
    if (req.user.id !== req.params.id && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Input validation
    const userId = z.string().uuid().parse(req.params.id);

    // Query with parameterization
    const orders = await db.query(
      'SELECT * FROM orders WHERE user_id = $1',
      [userId]
    );

    // Filter sensitive fields
    const sanitized = orders.map(order => ({
      id: order.id,
      status: order.status,
      total: order.total,
      createdAt: order.createdAt,
      // Don't expose: payment_method, internal_notes
    }));

    res.json(sanitized);
  }
);
```

### Scenario 2: File Upload

```typescript
// Threat model for file upload feature

const fileUploadThreats = {
  'File Type Validation': [
    'Upload executable disguised as image',
    'Upload web shell (PHP, JSP)',
    'Polyglot files (valid image + executable)',
  ],
  'File Size': [
    'DoS via large file uploads',
    'Disk space exhaustion',
  ],
  'File Storage': [
    'Path traversal to overwrite system files',
    'Predictable filenames allow enumeration',
    'Files served with execute permissions',
  ],
  'File Content': [
    'Malware distribution',
    'XSS via SVG files',
    'XXE via XML files',
  ],
};

// Mitigated implementation
import multer from 'multer';
import crypto from 'crypto';
import { fileTypeFromBuffer } from 'file-type';

const upload = multer({
  storage: multer.memoryStorage(), // Don't save directly to disk
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
    files: 1, // One file at a time
  },
});

app.post('/api/upload', authenticate, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file provided' });
  }

  // Verify actual file type (not just extension)
  const fileType = await fileTypeFromBuffer(req.file.buffer);

  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
  if (!fileType || !allowedTypes.includes(fileType.mime)) {
    return res.status(400).json({ error: 'Invalid file type' });
  }

  // Generate random filename (prevent enumeration)
  const filename = `${crypto.randomBytes(16).toString('hex')}.${fileType.ext}`;

  // Store in isolated directory with no execute permissions
  const uploadPath = path.join('/uploads', req.user.id, filename);

  // Scan for malware (if applicable)
  // await scanFileForMalware(req.file.buffer);

  await fs.writeFile(uploadPath, req.file.buffer);

  res.json({
    filename,
    url: `/api/files/${filename}`,
  });
});
```

## Threat Modeling Checklist

### For Every Feature

- [ ] Identify assets (data, functionality)
- [ ] Map data flows
- [ ] Define trust boundaries
- [ ] Apply STRIDE to each component
- [ ] Assess risk (likelihood × impact)
- [ ] Define mitigations
- [ ] Implement security controls
- [ ] Validate with testing
- [ ] Document threats and mitigations
- [ ] Review and update regularly

### Common Mitigations

| Threat Type | Common Mitigations |
|-------------|-------------------|
| Spoofing | Strong authentication, MFA, certificate validation |
| Tampering | HTTPS, input validation, integrity checks |
| Repudiation | Logging, audit trails, digital signatures |
| Information Disclosure | Encryption, access controls, data minimization |
| Denial of Service | Rate limiting, resource quotas, auto-scaling |
| Elevation of Privilege | Least privilege, RBAC, input validation |

## Continuous Threat Modeling

```typescript
// Integrate threat modeling into development workflow

interface SecurityReview {
  feature: string;
  threats: Threat[];
  approvedBy: string;
  date: Date;
}

// Pre-implementation review
function requireThreatModel(feature: string): void {
  const review = getThreatModelReview(feature);

  if (!review) {
    throw new Error(
      `Feature ${feature} requires threat model review before implementation`
    );
  }

  if (!review.approvedBy) {
    throw new Error(`Threat model for ${feature} not approved`);
  }
}

// Automated checks in CI/CD
// - Detect new API endpoints → require threat model
// - Detect authentication changes → require security review
// - Detect database schema changes → review for injection risks
```

## Resources and Tools

- **Microsoft Threat Modeling Tool** - Visual threat modeling
- **OWASP Threat Dragon** - Open source threat modeling
- **pytm** - Python threat modeling framework
- **Threatspec** - Threat modeling as code
- **STRIDE per Element** - Systematic STRIDE application

## Best Practices

1. **Start early** - Threat model in design phase
2. **Iterate** - Update as system evolves
3. **Focus on high-risk areas** - Authentication, sensitive data
4. **Document** - Keep threat models up to date
5. **Validate** - Test that mitigations work
6. **Review** - Regular security reviews
7. **Automate** - Integrate into CI/CD
