# Secrets Management

Best practices for storing, accessing, and managing secrets, API keys, and sensitive configuration.

## Never Commit Secrets

### .gitignore Essentials

```gitignore
# Environment files
.env
.env.*
!.env.example

# Private keys
*.key
*.pem
*.p12
*.pfx

# Secrets and credentials
secrets.json
credentials.json
config/secrets.yml

# IDE files that may contain secrets
.vscode/settings.json
.idea/
```

### Pre-commit Hook

```bash
#!/bin/bash
# .git/hooks/pre-commit

# Check for common secret patterns
if git diff --cached | grep -E "(API_KEY|SECRET|PASSWORD|TOKEN).*=.*['\"]?[a-zA-Z0-9]{20,}" >/dev/null; then
  echo "❌ Potential secret detected in commit!"
  echo "Please use environment variables or secret management."
  exit 1
fi

# Use git-secrets or similar tools
git secrets --scan || exit 1
```

## Environment Variables

### .env Files

```bash
# .env.example (checked into git)
DATABASE_URL=postgres://localhost:5432/myapp
REDIS_URL=redis://localhost:6379
API_KEY=your_api_key_here
JWT_SECRET=generate_with_openssl_rand

# .env (NOT checked into git)
DATABASE_URL=postgres://user:password@prod-db:5432/myapp
REDIS_URL=redis://:password@prod-redis:6379
API_KEY=sk_live_actual_key_here
JWT_SECRET=extremely_long_random_string_here
```

### Loading Environment Variables

```typescript
import dotenv from 'dotenv';
import { z } from 'zod';

// Load .env file
dotenv.config();

// Validate required environment variables
const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production']),
  PORT: z.string().transform(Number),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  API_KEY: z.string().min(20),
});

// Parse and validate
const env = EnvSchema.parse(process.env);

export default env;
```

## AWS Secrets Manager

### Storing Secrets

```typescript
import { SecretsManagerClient, CreateSecretCommand } from '@aws-sdk/client-secrets-manager';

const client = new SecretsManagerClient({ region: 'us-east-1' });

async function createSecret(name: string, value: string) {
  await client.send(new CreateSecretCommand({
    Name: name,
    SecretString: JSON.stringify({ value }),
    Description: 'API key for external service',
  }));
}
```

### Retrieving Secrets

```typescript
import { GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

async function getSecret(name: string): Promise<string> {
  const response = await client.send(new GetSecretValueCommand({
    SecretId: name,
  }));

  if (!response.SecretString) {
    throw new Error('Secret not found');
  }

  const secret = JSON.parse(response.SecretString);
  return secret.value;
}

// Cache secrets to reduce API calls
const secretCache = new Map<string, { value: string; expires: number }>();

async function getCachedSecret(name: string): Promise<string> {
  const cached = secretCache.get(name);

  if (cached && cached.expires > Date.now()) {
    return cached.value;
  }

  const value = await getSecret(name);

  secretCache.set(name, {
    value,
    expires: Date.now() + 5 * 60 * 1000, // 5 minutes
  });

  return value;
}
```

### Using in Application

```typescript
// config/secrets.ts
let apiKey: string | null = null;

export async function getApiKey(): Promise<string> {
  if (!apiKey) {
    if (process.env.NODE_ENV === 'production') {
      apiKey = await getCachedSecret('prod/api-key');
    } else {
      apiKey = process.env.API_KEY!;
    }
  }
  return apiKey;
}

// Usage
import { getApiKey } from './config/secrets';

async function callExternalApi() {
  const apiKey = await getApiKey();
  const response = await fetch('https://api.example.com/data', {
    headers: { 'X-API-Key': apiKey },
  });
  return response.json();
}
```

## HashiCorp Vault

### Setup

```typescript
import vault from 'node-vault';

const vaultClient = vault({
  endpoint: process.env.VAULT_ADDR || 'http://localhost:8200',
  token: process.env.VAULT_TOKEN,
});

// Enable AppRole authentication
async function loginWithAppRole(roleId: string, secretId: string) {
  const result = await vaultClient.approleLogin({
    role_id: roleId,
    secret_id: secretId,
  });

  // Update client with new token
  vaultClient.token = result.auth.client_token;

  // Set up token renewal
  setInterval(async () => {
    await vaultClient.tokenRenewSelf();
  }, 3600000); // Renew every hour
}
```

### Reading Secrets

```typescript
async function getVaultSecret(path: string): Promise<any> {
  const result = await vaultClient.read(path);
  return result.data;
}

// Example usage
const dbCreds = await getVaultSecret('secret/data/database');
const dbUrl = `postgres://${dbCreds.username}:${dbCreds.password}@${dbCreds.host}:5432/myapp`;
```

### Dynamic Secrets

```typescript
// Request temporary database credentials
async function getDatabaseCredentials(): Promise<{ username: string; password: string }> {
  const result = await vaultClient.read('database/creds/myapp-role');

  return {
    username: result.data.username,
    password: result.data.password,
  };
}

// Credentials are automatically rotated and expired
const creds = await getDatabaseCredentials();
// Use for 1 hour, then request new ones
```

## Kubernetes Secrets

### Creating Secrets

```yaml
# secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: app-secrets
type: Opaque
stringData:
  database-url: postgres://user:pass@host:5432/db
  api-key: sk_live_xxx
```

```bash
# Create from file
kubectl create secret generic app-secrets \
  --from-file=./secrets.json

# Create from literal
kubectl create secret generic app-secrets \
  --from-literal=api-key=sk_live_xxx \
  --from-literal=db-password=strongpass
```

### Using Secrets in Pods

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
spec:
  template:
    spec:
      containers:
        - name: myapp
          image: myapp:latest
          env:
            # Single secret as env var
            - name: API_KEY
              valueFrom:
                secretKeyRef:
                  name: app-secrets
                  key: api-key
          envFrom:
            # All secrets as env vars
            - secretRef:
                name: app-secrets
          volumeMounts:
            # Secret as file
            - name: secret-volume
              mountPath: /etc/secrets
              readOnly: true
      volumes:
        - name: secret-volume
          secret:
            secretName: app-secrets
```

### External Secrets Operator

```yaml
# external-secret.yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: app-secrets
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: aws-secrets-manager
    kind: SecretStore
  target:
    name: app-secrets
    creationPolicy: Owner
  data:
    - secretKey: api-key
      remoteRef:
        key: prod/api-key
    - secretKey: database-url
      remoteRef:
        key: prod/database-url
```

## Secret Rotation

### Automatic Rotation

```typescript
// secrets-rotator.ts
import { scheduleJob } from 'node-schedule';

interface SecretRotator {
  name: string;
  rotate: () => Promise<void>;
  schedule: string; // Cron expression
}

const rotators: SecretRotator[] = [
  {
    name: 'api-key',
    rotate: rotateApiKey,
    schedule: '0 0 * * 0', // Weekly on Sunday
  },
  {
    name: 'jwt-secret',
    rotate: rotateJwtSecret,
    schedule: '0 0 1 * *', // Monthly on 1st
  },
];

// Schedule rotation jobs
for (const rotator of rotators) {
  scheduleJob(rotator.schedule, async () => {
    try {
      await rotator.rotate();
      logger.info(`Rotated secret: ${rotator.name}`);
    } catch (error) {
      logger.error(`Failed to rotate secret: ${rotator.name}`, error);
    }
  });
}

async function rotateApiKey() {
  // Generate new key
  const newKey = generateRandomString(32);

  // Update in secret manager
  await updateSecret('prod/api-key', newKey);

  // Graceful transition: keep old key valid for 24h
  await updateSecret('prod/api-key-old', await getSecret('prod/api-key'));

  // Notify services
  await notifyServicesOfRotation('api-key');
}

async function rotateJwtSecret() {
  // Generate new secret
  const newSecret = generateRandomString(64);

  // Store new secret
  await updateSecret('prod/jwt-secret-new', newSecret);

  // Update application config (rolling restart)
  await triggerRollingRestart();

  // After all instances updated, remove old secret
  setTimeout(async () => {
    await deleteSecret('prod/jwt-secret-old');
  }, 24 * 60 * 60 * 1000); // 24 hours
}
```

### Zero-Downtime Rotation

```typescript
// Support multiple valid secrets during rotation
class SecretManager {
  private secrets: Map<string, string[]> = new Map();

  async addSecret(name: string, value: string) {
    const current = this.secrets.get(name) || [];
    this.secrets.set(name, [value, ...current].slice(0, 2)); // Keep 2 versions
  }

  async validateSecret(name: string, value: string): Promise<boolean> {
    const validSecrets = this.secrets.get(name) || [];
    return validSecrets.includes(value);
  }

  async rotateSecret(name: string, newValue: string) {
    await this.addSecret(name, newValue);

    // Old secret remains valid for grace period
    setTimeout(() => {
      const current = this.secrets.get(name) || [];
      this.secrets.set(name, current.slice(0, 1)); // Remove oldest
    }, 24 * 60 * 60 * 1000); // 24 hours
  }
}
```

## Secret Injection at Runtime

### Docker Secrets

```yaml
# docker-compose.yml
version: '3.8'
services:
  app:
    image: myapp:latest
    secrets:
      - db_password
      - api_key
    environment:
      DB_PASSWORD_FILE: /run/secrets/db_password
      API_KEY_FILE: /run/secrets/api_key

secrets:
  db_password:
    file: ./secrets/db_password.txt
  api_key:
    file: ./secrets/api_key.txt
```

```typescript
// Read secrets from files
import { readFileSync } from 'fs';

function getSecretFromFile(envVar: string): string {
  const filePath = process.env[envVar];

  if (!filePath) {
    throw new Error(`${envVar} not set`);
  }

  return readFileSync(filePath, 'utf8').trim();
}

const dbPassword = getSecretFromFile('DB_PASSWORD_FILE');
const apiKey = getSecretFromFile('API_KEY_FILE');
```

## Auditing Secret Access

### Logging

```typescript
import winston from 'winston';

const secretLogger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'secrets-audit.log' }),
  ],
});

async function getSecretWithAudit(name: string, requester: string): Promise<string> {
  secretLogger.info({
    event: 'secret.accessed',
    secret: name,
    requester,
    timestamp: new Date().toISOString(),
    ip: getRequesterIp(),
  });

  return await getSecret(name);
}
```

### Alerting on Anomalies

```typescript
// Detect unusual secret access patterns
const accessCounts = new Map<string, number>();

async function detectAnomalousAccess(secretName: string) {
  const count = accessCounts.get(secretName) || 0;
  accessCounts.set(secretName, count + 1);

  // Alert if secret accessed too frequently
  if (count > 100) {
    await sendAlert({
      severity: 'high',
      message: `Secret ${secretName} accessed ${count} times in 5 minutes`,
    });
  }

  // Reset counter every 5 minutes
  setTimeout(() => {
    accessCounts.delete(secretName);
  }, 5 * 60 * 1000);
}
```

## Best Practices

### General Guidelines

1. **Never commit secrets to version control**
   - Use .env files (gitignored)
   - Use secret management services
   - Scan commits for secrets

2. **Use different secrets per environment**
   - Development, staging, production
   - Never use production secrets in dev

3. **Rotate secrets regularly**
   - API keys: quarterly
   - Passwords: monthly
   - Certificates: before expiry

4. **Principle of least privilege**
   - Only give access to secrets that are needed
   - Use short-lived credentials when possible

5. **Encrypt secrets at rest and in transit**
   - Use TLS for transmission
   - Encrypt storage with KMS

6. **Audit secret access**
   - Log who accessed what and when
   - Alert on anomalies
   - Review logs regularly

### Secret Checklist

- [ ] No secrets in source code
- [ ] .env files in .gitignore
- [ ] Pre-commit hooks to detect secrets
- [ ] Environment variables validated on startup
- [ ] Production secrets in secret manager (AWS/Vault/etc)
- [ ] Different secrets per environment
- [ ] Secrets rotated regularly
- [ ] Access to secrets logged
- [ ] Least privilege access
- [ ] Secrets encrypted at rest
- [ ] TLS for secret transmission
- [ ] Backup and recovery plan for secrets
