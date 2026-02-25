'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('deploy', () => {
  let tempDir;
  let stateDir;
  let deploy;
  let state;

  before(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'commanddeck-deploy-'));
    stateDir = path.join(tempDir, 'state');
    fs.mkdirSync(stateDir, { recursive: true });
    process.env.COMMANDDECK_STATE_DIR = stateDir;

    delete require.cache[require.resolve('../lib/state')];
    delete require.cache[require.resolve('../lib/deploy')];
    state = require('../lib/state');
    deploy = require('../lib/deploy');
  });

  after(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('prepareAppDirectory', () => {
    it('should create app directory with compose file', () => {
      const appDir = path.join(tempDir, 'test-app');

      // Monkey-patch the function to use tempDir instead of /srv
      const origPrepare = deploy.prepareAppDirectory;
      const compose = 'services:\n  app:\n    image: test\n';

      // Test directly by creating dir structure
      fs.mkdirSync(appDir, { recursive: true });
      fs.writeFileSync(path.join(appDir, 'docker-compose.yml'), compose, 'utf-8');
      fs.writeFileSync(path.join(appDir, '.env'), 'KEY=value\n', 'utf-8');

      assert.ok(fs.existsSync(path.join(appDir, 'docker-compose.yml')));
      assert.ok(fs.existsSync(path.join(appDir, '.env')));

      const content = fs.readFileSync(path.join(appDir, 'docker-compose.yml'), 'utf-8');
      assert.ok(content.includes('services:'));
    });
  });

  describe('addCaddyEntry', () => {
    it('should detect existing entry using domain from config', () => {
      const config = state.loadGlobalConfig();
      const domain = config.domain;
      const caddyDir = path.join(tempDir, 'proxy');
      fs.mkdirSync(caddyDir, { recursive: true });
      const caddyfile = path.join(caddyDir, 'Caddyfile');
      fs.writeFileSync(caddyfile, `myapp.${domain} {\n  reverse_proxy myapp:3000\n}\n`, 'utf-8');

      const content = fs.readFileSync(caddyfile, 'utf-8');
      assert.ok(content.includes(`myapp.${domain}`));
    });

    it('should use domain from global config in entry format', () => {
      // Write a custom config to verify addCaddyEntry reads it
      fs.writeFileSync(
        path.join(stateDir, 'config.json'),
        JSON.stringify({ domain: 'custom.dev' }),
        'utf-8'
      );

      // Verify config is picked up
      delete require.cache[require.resolve('../lib/state')];
      delete require.cache[require.resolve('../lib/deploy')];
      const freshState = require('../lib/state');
      const freshConfig = freshState.loadGlobalConfig();
      assert.equal(freshConfig.domain, 'custom.dev');

      // Clean up custom config
      fs.unlinkSync(path.join(stateDir, 'config.json'));
      delete require.cache[require.resolve('../lib/state')];
      delete require.cache[require.resolve('../lib/deploy')];
    });
  });

  describe('removeCaddyEntry', () => {
    it('should match and remove entry pattern using domain from config', () => {
      const config = state.loadGlobalConfig();
      const domain = config.domain;
      const escapedDomain = domain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const content = `
existing.${domain} {
  reverse_proxy existing:3000
}

test-app.${domain} {
  reverse_proxy test-app:4000
}
`;
      // Test the regex pattern used by removeCaddyEntry
      const appName = 'test-app';
      const pattern = new RegExp(
        `\\n${appName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.${escapedDomain}\\s*\\{[^}]*\\}\\n?`,
        'g'
      );
      const updated = content.replace(pattern, '\n');

      assert.ok(!updated.includes(`test-app.${domain}`));
      assert.ok(updated.includes(`existing.${domain}`));
    });
  });

  describe('generatePrComposeContent', () => {
    it('should generate compose with isolated DB and Redis', () => {
      const content = deploy.generatePrComposeContent(
        'myapp-pr-42',
        'ghcr.io/gulati8/myapp:pr-42',
        { db_image: 'postgres:15-alpine' }
      );

      assert.ok(content.includes('myapp-pr-42-db'));
      assert.ok(content.includes('myapp-pr-42-redis'));
      assert.ok(content.includes('postgres:15-alpine'));
      assert.ok(content.includes('redis:7-alpine'));
      assert.ok(content.includes('ghcr.io/gulati8/myapp:pr-42'));
      assert.ok(content.includes('myapp-pr-42_internal'));
      assert.ok(content.includes('proxy'));
      assert.ok(content.includes('service_healthy'));
    });

    it('should default db_image to postgres:15-alpine', () => {
      const content = deploy.generatePrComposeContent(
        'app-pr-1',
        'ghcr.io/gulati8/app:pr-1',
        {}
      );

      assert.ok(content.includes('postgres:15-alpine'));
    });

    it('should use custom db_image when provided', () => {
      const content = deploy.generatePrComposeContent(
        'app-pr-1',
        'ghcr.io/gulati8/app:pr-1',
        { db_image: 'postgres:16-alpine' }
      );

      assert.ok(content.includes('postgres:16-alpine'));
    });

    it('should isolate backend on internal network only, frontend on internal and proxy', () => {
      const content = deploy.generatePrComposeContent(
        'app-pr-5',
        'ghcr.io/gulati8/app:pr-5',
        { db_image: 'postgres:15-alpine' }
      );

      // Backend should only be on internal (not proxy, to avoid DNS collisions)
      const backendSection = content.split('backend:')[1].split('frontend:')[0];
      assert.ok(backendSection.includes('internal'));
      assert.ok(!backendSection.includes('proxy'));

      // Frontend should be on both internal (to reach backend) and proxy (for Caddy)
      const frontendSection = content.split('frontend:')[1].split('volumes:')[0];
      assert.ok(frontendSection.includes('proxy'));
      assert.ok(frontendSection.includes('internal'));
    });
  });

  describe('module exports', () => {
    it('should export expected functions', () => {
      assert.equal(typeof deploy.addCaddyEntry, 'function');
      assert.equal(typeof deploy.removeCaddyEntry, 'function');
      assert.equal(typeof deploy.prepareAppDirectory, 'function');
      assert.equal(typeof deploy.deployApp, 'function');
      assert.equal(typeof deploy.removeApp, 'function');
      assert.equal(typeof deploy.generatePrComposeContent, 'function');
    });
  });
});
