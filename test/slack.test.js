'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const db = require('../lib/db');

function freshSlackModule(tempDir) {
  process.env.COMMANDDECK_STATE_DIR = tempDir;
  // Reset db connection to use new state dir
  db.close();
  db.getDb();
  delete require.cache[require.resolve('../lib/slack')];
  return require('../lib/slack');
}

describe('slack', () => {
  describe('channel map', () => {
    it('should detect repo from channel map', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'commanddeck-slack-'));
      const slackMod = freshSlackModule(tempDir);

      // Write channel map to SQLite
      db.setChannelMapping('C123', 'MyProject');
      db.setChannelMapping('C456', 'OtherProject');

      assert.equal(slackMod.detectRepoFromChannel('C123'), 'MyProject');
      assert.equal(slackMod.detectRepoFromChannel('C999'), null);

      db.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('should find channel for repo (reverse lookup)', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'commanddeck-slack-'));
      const slackMod = freshSlackModule(tempDir);

      db.setChannelMapping('C123', 'MyProject');
      db.setChannelMapping('C456', 'OtherProject');

      assert.equal(slackMod.findChannelForRepo('MyProject'), 'C123');
      assert.equal(slackMod.findChannelForRepo('OtherProject'), 'C456');
      assert.equal(slackMod.findChannelForRepo('NonExistent'), null);

      db.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('should return null when no channel map exists', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'commanddeck-slack-'));
      const slackMod = freshSlackModule(tempDir);

      assert.equal(slackMod.detectRepoFromChannel('C123'), null);
      assert.equal(slackMod.findChannelForRepo('MyProject'), null);

      db.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    });
  });

  describe('PR approval tracking', () => {
    it('should track and retrieve PR approvals', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'commanddeck-slack-'));
      const slackMod = freshSlackModule(tempDir);

      slackMod.trackPRApproval('789.01', {
        repo: 'test-repo',
        mission_id: 'mission-001',
        pr_number: 42,
        pr_url: 'https://github.com/test/repo/pull/42',
        channel: 'C123',
        thread_ts: '111.222'
      });

      const approval = slackMod.getPRApproval('789.01');
      assert.equal(approval.repo, 'test-repo');
      assert.equal(approval.pr_number, 42);
      assert.equal(approval.channel, 'C123');
      assert.ok(approval.tracked_at);

      db.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('should remove PR approvals', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'commanddeck-slack-'));
      const slackMod = freshSlackModule(tempDir);

      slackMod.trackPRApproval('999.01', {
        repo: 'test-repo',
        mission_id: 'mission-002',
        pr_number: 7
      });

      assert.ok(slackMod.getPRApproval('999.01'));
      slackMod.removePRApproval('999.01');
      assert.equal(slackMod.getPRApproval('999.01'), null);

      db.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('should return null for non-existent approval', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'commanddeck-slack-'));
      const slackMod = freshSlackModule(tempDir);

      assert.equal(slackMod.getPRApproval('nonexistent'), null);

      db.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    });
  });

  describe('plan approval tracking', () => {
    it('should track and retrieve plan approvals', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'commanddeck-slack-'));
      const slackMod = freshSlackModule(tempDir);

      slackMod.trackPlanApproval('plan.01', {
        repo: 'test-repo',
        mission_id: 'mission-003',
        channel: 'C123',
        thread_ts: '111.333'
      });

      const approval = slackMod.getPlanApproval('plan.01');
      assert.equal(approval.repo, 'test-repo');
      assert.equal(approval.mission_id, 'mission-003');
      assert.equal(approval.channel, 'C123');
      assert.ok(approval.tracked_at);

      db.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('should remove plan approvals', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'commanddeck-slack-'));
      const slackMod = freshSlackModule(tempDir);

      slackMod.trackPlanApproval('plan.02', {
        repo: 'test-repo',
        mission_id: 'mission-004'
      });

      assert.ok(slackMod.getPlanApproval('plan.02'));
      slackMod.removePlanApproval('plan.02');
      assert.equal(slackMod.getPlanApproval('plan.02'), null);

      db.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('should return null for non-existent plan approval', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'commanddeck-slack-'));
      const slackMod = freshSlackModule(tempDir);

      assert.equal(slackMod.getPlanApproval('nonexistent'), null);

      db.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    });
  });

  describe('proposal tracking', () => {
    it('should track and retrieve proposals', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'commanddeck-slack-'));
      const slackMod = freshSlackModule(tempDir);

      slackMod.trackProposal('123.45', {
        proposedPath: '/tmp/p.md',
        targetDir: '/tmp',
        fileName: 'p.md'
      });

      const proposal = slackMod.getProposal('123.45');
      assert.equal(proposal.proposedPath, '/tmp/p.md');
      assert.equal(proposal.targetDir, '/tmp');
      assert.equal(proposal.fileName, 'p.md');

      db.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('should remove proposals', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'commanddeck-slack-'));
      const slackMod = freshSlackModule(tempDir);

      slackMod.trackProposal('456.78', {
        proposedPath: '/tmp/q.md',
        targetDir: '/tmp',
        fileName: 'q.md'
      });

      assert.ok(slackMod.getProposal('456.78'));
      slackMod.removeProposal('456.78');
      assert.equal(slackMod.getProposal('456.78'), null);

      db.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    });
  });
});
