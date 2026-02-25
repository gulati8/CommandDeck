'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const { logEvent } = require('./observability');
const { loadGlobalConfig } = require('./state');

// Add a Caddy reverse proxy entry for an app
function addCaddyEntry(appName, port) {
  const globalConfig = loadGlobalConfig();
  const caddyfilePath = globalConfig.caddyfile_path;
  const domain = globalConfig.domain;
  const caddyContainer = globalConfig.caddy_container;

  const entry = `
${appName}.${domain} {
  reverse_proxy ${appName}:${port}
}
`;

  // Check if entry already exists
  let content = '';
  try {
    content = fs.readFileSync(caddyfilePath, 'utf-8');
  } catch {
    // Caddyfile doesn't exist yet
  }

  if (content.includes(`${appName}.${domain}`)) {
    return { action: 'exists', appName };
  }

  fs.appendFileSync(caddyfilePath, entry, 'utf-8');

  // Reload Caddy
  try {
    execFileSync('docker', [
      'exec', caddyContainer, 'caddy', 'reload',
      '--config', '/etc/caddy/Caddyfile'
    ], { stdio: 'pipe' });
  } catch {
    // Caddy container might have a different name
    try {
      execFileSync('docker', [
        'exec', 'caddy', 'caddy', 'reload',
        '--config', '/etc/caddy/Caddyfile'
      ], { stdio: 'pipe' });
    } catch {
      // Log but don't fail — manual reload may be needed
      logEvent('caddy.reload_failed', { appName });
    }
  }

  logEvent('caddy.entry_added', { appName, port });
  return { action: 'added', appName, port };
}

// Remove a Caddy entry for an app (e.g., PR environment cleanup)
function removeCaddyEntry(appName) {
  const globalConfig = loadGlobalConfig();
  const caddyfilePath = globalConfig.caddyfile_path;
  const domain = globalConfig.domain;
  const caddyContainer = globalConfig.caddy_container;

  let content;
  try {
    content = fs.readFileSync(caddyfilePath, 'utf-8');
  } catch {
    return { action: 'not_found', appName };
  }

  // Remove the block for this app
  const escapedDomain = domain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(
    `\\n${appName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.${escapedDomain}\\s*\\{[^}]*\\}\\n?`,
    'g'
  );

  const updated = content.replace(pattern, '\n');

  if (updated === content) {
    return { action: 'not_found', appName };
  }

  fs.writeFileSync(caddyfilePath, updated, 'utf-8');

  // Reload Caddy
  try {
    execFileSync('docker', [
      'exec', caddyContainer, 'caddy', 'reload',
      '--config', '/etc/caddy/Caddyfile'
    ], { stdio: 'pipe' });
  } catch {
    try {
      execFileSync('docker', [
        'exec', 'caddy', 'caddy', 'reload',
        '--config', '/etc/caddy/Caddyfile'
      ], { stdio: 'pipe' });
    } catch {
      logEvent('caddy.reload_failed', { appName });
    }
  }

  logEvent('caddy.entry_removed', { appName });
  return { action: 'removed', appName };
}

// Prepare app directory with compose and env files
function prepareAppDirectory(appName, composeContent, envContent) {
  const globalConfig = loadGlobalConfig();
  const appDir = path.join(globalConfig.deploy_dir, appName);
  fs.mkdirSync(appDir, { recursive: true });

  fs.writeFileSync(
    path.join(appDir, 'docker-compose.yml'),
    composeContent,
    'utf-8'
  );

  if (envContent) {
    fs.writeFileSync(
      path.join(appDir, '.env'),
      envContent,
      'utf-8'
    );
  }

  logEvent('app.directory_prepared', { appName, path: appDir });
  return appDir;
}

// Deploy an app by pulling and starting its compose stack
function deployApp(appName) {
  const globalConfig = loadGlobalConfig();
  const appDir = path.join(globalConfig.deploy_dir, appName);

  if (!fs.existsSync(path.join(appDir, 'docker-compose.yml'))) {
    throw new Error(`No docker-compose.yml found in ${appDir}`);
  }

  execFileSync('docker', ['compose', 'pull'], {
    cwd: appDir,
    stdio: 'pipe',
    encoding: 'utf-8'
  });

  execFileSync('docker', ['compose', 'up', '-d', '--remove-orphans'], {
    cwd: appDir,
    stdio: 'pipe',
    encoding: 'utf-8'
  });

  logEvent('app.deployed', { appName });
  return { appName, status: 'deployed' };
}

// Stop and remove an app's compose stack
function removeApp(appName) {
  const globalConfig = loadGlobalConfig();
  const appDir = path.join(globalConfig.deploy_dir, appName);

  if (!fs.existsSync(path.join(appDir, 'docker-compose.yml'))) {
    return { appName, status: 'not_found' };
  }

  try {
    execFileSync('docker', ['compose', 'down', '--remove-orphans'], {
      cwd: appDir,
      stdio: 'pipe',
      encoding: 'utf-8'
    });
  } catch {
    // Compose stack may not be running
  }

  logEvent('app.removed', { appName });
  return { appName, status: 'removed' };
}

// Generate a docker-compose.yml for a PR environment with isolated DB/Redis
function generatePrComposeContent(appName, imageRef, projectConfig) {
  const dbContainer = `${appName}-db`;
  const redisContainer = `${appName}-redis`;
  const dbImage = projectConfig.db_image || 'postgres:15-alpine';
  const networkName = `${appName}_internal`;

  let compose = `services:
  postgres:
    image: ${dbImage}
    container_name: ${dbContainer}
    restart: unless-stopped
    environment:
      POSTGRES_DB: \${POSTGRES_DB}
      POSTGRES_USER: \${POSTGRES_USER}
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD}
    volumes:
      - db_data:/var/lib/postgresql/data
    networks:
      - internal
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U \${POSTGRES_USER}"]
      interval: 5s
      timeout: 3s
      retries: 10

  redis:
    image: redis:7-alpine
    container_name: ${redisContainer}
    restart: unless-stopped
    networks:
      - internal

  backend:
    image: ${imageRef}
    container_name: ${appName}-api
    restart: unless-stopped
    env_file: .env
    environment:
      DATABASE_URL: postgres://\${POSTGRES_USER}:\${POSTGRES_PASSWORD}@${dbContainer}:5432/\${POSTGRES_DB}
      REDIS_URL: redis://${redisContainer}:6379
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - internal

  frontend:
    image: ${imageRef}
    container_name: ${appName}
    restart: unless-stopped
    env_file: .env
    depends_on:
      - backend
    networks:
      - internal
      - proxy

volumes:
  db_data:

networks:
  internal:
    name: ${networkName}
  proxy:
    external: true
`;
  return compose;
}

module.exports = {
  addCaddyEntry,
  removeCaddyEntry,
  prepareAppDirectory,
  deployApp,
  removeApp,
  generatePrComposeContent
};
