'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const { logEvent } = require('./observability');

// Add a Caddy reverse proxy entry for an app
function addCaddyEntry(appName, port) {
  const caddyfilePath = '/srv/proxy/Caddyfile';

  const entry = `
${appName}.gulatilabs.me {
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

  if (content.includes(`${appName}.gulatilabs.me`)) {
    return { action: 'exists', appName };
  }

  fs.appendFileSync(caddyfilePath, entry, 'utf-8');

  // Reload Caddy
  try {
    execFileSync('docker', [
      'exec', 'proxy-caddy-1', 'caddy', 'reload',
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
  const caddyfilePath = '/srv/proxy/Caddyfile';

  let content;
  try {
    content = fs.readFileSync(caddyfilePath, 'utf-8');
  } catch {
    return { action: 'not_found', appName };
  }

  // Remove the block for this app
  const pattern = new RegExp(
    `\\n${appName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.gulatilabs\\.me\\s*\\{[^}]*\\}\\n?`,
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
      'exec', 'proxy-caddy-1', 'caddy', 'reload',
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
  const appDir = path.join('/srv', appName);
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
  const appDir = path.join('/srv', appName);

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
  const appDir = path.join('/srv', appName);

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

module.exports = {
  addCaddyEntry,
  removeCaddyEntry,
  prepareAppDirectory,
  deployApp,
  removeApp
};
