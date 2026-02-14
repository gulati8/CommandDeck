'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const TEST_STATE_DIR = path.join(os.tmpdir(), `commanddeck-learn-test-${Date.now()}`);
process.env.COMMANDDECK_STATE_DIR = TEST_STATE_DIR;

const learn = require('../lib/learn');

describe('learn', () => {
  before(() => {
    fs.mkdirSync(TEST_STATE_DIR, { recursive: true });
  });

  after(() => {
    fs.rmSync(TEST_STATE_DIR, { recursive: true, force: true });
  });

  describe('detectScope', () => {
    it('should detect standard scope by default', () => {
      const result = learn.detectScope('always use semicolons');
      assert.equal(result.scope, 'standard');
    });

    it('should detect crew scope for agent names', () => {
      const result = learn.detectScope('Spock should always run tests first');
      assert.equal(result.scope, 'crew');
      assert.equal(result.agent, 'spock');
    });

    it('should detect crew scope for Borg', () => {
      const result = learn.detectScope('tell borg to use TypeScript');
      assert.equal(result.scope, 'crew');
      assert.equal(result.agent, 'borg');
    });

    it('should normalize agent names', () => {
      const picard = learn.detectScope('Picard should plan in phases');
      assert.equal(picard.agent, 'captain-picard');

      const data = learn.detectScope('Data should validate schemas');
      assert.equal(data.agent, 'mr-data');

      const obrien = learn.detectScope("O'Brien should use merge-base");
      assert.equal(obrien.agent, 'obrien');
    });

    it('should detect directive scope for "in <repo>"', () => {
      const result = learn.detectScope('in invoicing-app, use soft delete');
      assert.equal(result.scope, 'directive');
      assert.equal(result.repo, 'invoicing-app');
    });

    it('should not grab trailing commas in repo name', () => {
      const result = learn.detectScope('in my-api, always use REST');
      assert.equal(result.repo, 'my-api');
      assert.ok(!result.repo.includes(','));
    });

    it('should detect directive scope for "in this project"', () => {
      const result = learn.detectScope('in this project, use ESM modules');
      assert.equal(result.scope, 'directive');
      assert.equal(result.repo, null);
    });

    it('should detect playbook scope', () => {
      const result = learn.detectScope('create a playbook for React component patterns');
      assert.equal(result.scope, 'playbook');
    });

    it('should detect playbook scope for template keyword', () => {
      const result = learn.detectScope('standard approach for API error handling');
      assert.equal(result.scope, 'playbook');
    });
  });

  describe('propose', () => {
    it('should create a directive directly for project scope', async () => {
      const result = await learn.propose('in test-project, use tabs for indentation', {});
      assert.equal(result.success, true);
      assert.equal(result.scope, 'directive');
      assert.equal(result.repo, 'test-project');
      assert.ok(!result.needsApproval);
      assert.ok(fs.existsSync(result.path));
    });

    it('should require governance for standard scope', async () => {
      const result = await learn.propose('always use error boundaries', {});
      assert.equal(result.success, true);
      assert.equal(result.scope, 'standard');
      assert.equal(result.needsApproval, true);
      assert.ok(fs.existsSync(result.proposedPath));
    });

    it('should require governance for crew scope', async () => {
      const result = await learn.propose('Worf should check OWASP top 10', {});
      assert.equal(result.success, true);
      assert.equal(result.scope, 'crew');
      assert.equal(result.needsApproval, true);
      assert.ok(result.fileName.includes('worf'));
    });

    it('should fail for directive without repo', async () => {
      const result = await learn.propose('in this project, use strict mode', {});
      assert.equal(result.success, false);
      assert.ok(result.message.includes('repo'));
    });
  });

  describe('approve / reject', () => {
    it('should approve a proposal by moving it to active dir', async () => {
      const result = await learn.propose('always validate inputs', {});
      assert.equal(result.needsApproval, true);

      const approved = learn.approve(result.proposedPath, result.targetDir, result.fileName);
      assert.equal(approved.success, true);
      assert.ok(approved.message.includes('approved'));
      assert.ok(!fs.existsSync(result.proposedPath)); // removed from proposed
    });

    it('should reject a proposal by deleting it', async () => {
      const result = await learn.propose('never use eval', {});
      assert.equal(result.needsApproval, true);

      const rejected = learn.reject(result.proposedPath);
      assert.equal(rejected.success, true);
      assert.ok(!fs.existsSync(result.proposedPath));
    });

    it('should handle approve of non-existent path', () => {
      const result = learn.approve('/nonexistent/path.md', '/target', 'file.md');
      assert.equal(result.success, false);
    });

    it('should handle reject of non-existent path', () => {
      const result = learn.reject('/nonexistent/path.md');
      assert.equal(result.success, false);
    });
  });

  describe('listPending', () => {
    it('should list pending proposals', async () => {
      // Create a few proposals
      await learn.propose('use prettier for formatting', {});
      await learn.propose('Scotty should review ADRs', {});

      const pending = learn.listPending();
      assert.ok(pending.length >= 2);
      assert.ok(pending.some(p => p.scope === 'standard'));
      assert.ok(pending.some(p => p.scope === 'crew'));
    });
  });
});
