'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

function freshSlackModule(tempDir) {
  process.env.COMMANDDECK_STATE_DIR = tempDir;
  delete require.cache[require.resolve('../lib/slack')];
  return require('../lib/slack');
}

describe('slack', () => {
  describe('channel map', () => {
    it('should detect repo from channel map', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'commanddeck-slack-'));
      const mapPath = path.join(tempDir, 'channel-map.json');
      fs.writeFileSync(mapPath, JSON.stringify({
        channel_map: { 'C123': 'MyProject', 'C456': 'OtherProject' }
      }));

      process.env.COMMANDDECK_CHANNEL_MAP = mapPath;
      delete require.cache[require.resolve('../lib/slack')];
      const slackMod = require('../lib/slack');

      assert.equal(slackMod.detectRepoFromChannel('C123'), 'MyProject');
      assert.equal(slackMod.detectRepoFromChannel('C999'), null);

      delete process.env.COMMANDDECK_CHANNEL_MAP;
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('should find channel for repo (reverse lookup)', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'commanddeck-slack-'));
      const mapPath = path.join(tempDir, 'channel-map.json');
      fs.writeFileSync(mapPath, JSON.stringify({
        channel_map: { 'C123': 'MyProject', 'C456': 'OtherProject' }
      }));

      process.env.COMMANDDECK_CHANNEL_MAP = mapPath;
      delete require.cache[require.resolve('../lib/slack')];
      const slackMod = require('../lib/slack');

      assert.equal(slackMod.findChannelForRepo('MyProject'), 'C123');
      assert.equal(slackMod.findChannelForRepo('OtherProject'), 'C456');
      assert.equal(slackMod.findChannelForRepo('NonExistent'), null);

      delete process.env.COMMANDDECK_CHANNEL_MAP;
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('should return null when channel map does not exist', () => {
      process.env.COMMANDDECK_CHANNEL_MAP = '/tmp/nonexistent-channel-map.json';
      delete require.cache[require.resolve('../lib/slack')];
      const slackMod = require('../lib/slack');

      assert.equal(slackMod.detectRepoFromChannel('C123'), null);
      assert.equal(slackMod.findChannelForRepo('MyProject'), null);

      delete process.env.COMMANDDECK_CHANNEL_MAP;
    });
  });

  describe('proposal tracking persistence', () => {
    it('should persist proposals across module reloads', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'commanddeck-slack-'));

      const slackA = freshSlackModule(tempDir);
      slackA.trackProposal('123.45', {
        proposedPath: '/tmp/p.md',
        targetDir: '/tmp',
        fileName: 'p.md'
      });

      const proposal = slackA.getProposal('123.45');
      assert.equal(proposal.proposedPath, '/tmp/p.md');
      assert.equal(proposal.targetDir, '/tmp');
      assert.equal(proposal.fileName, 'p.md');

      // Reload the module — proposals should persist from disk
      const slackB = freshSlackModule(tempDir);
      const reloaded = slackB.getProposal('123.45');
      assert.equal(reloaded.proposedPath, '/tmp/p.md');
      assert.equal(reloaded.targetDir, '/tmp');
      assert.equal(reloaded.fileName, 'p.md');

      // Verify the index file exists
      const indexPath = path.join(tempDir, 'proposed', 'index.json');
      assert.ok(fs.existsSync(indexPath));

      // Cleanup
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

      fs.rmSync(tempDir, { recursive: true, force: true });
    });
  });
});
