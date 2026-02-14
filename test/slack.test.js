'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

function freshSlackModule(tempDir) {
  process.env.COMMANDDECK_STATE_DIR = tempDir;
  delete require.cache[require.resolve('../lib/slack')];
  return require('../lib/slack');
}

test('proposal tracking persists across module reloads', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'commanddeck-slack-'));
  const slackA = freshSlackModule(tempDir);

  slackA.trackProposal('123.45', { proposedPath: '/tmp/p.md', targetDir: '/tmp', fileName: 'p.md' });
  assert.deepEqual(slackA.getProposal('123.45'), {
    proposedPath: '/tmp/p.md',
    targetDir: '/tmp',
    fileName: 'p.md'
  });

  const slackB = freshSlackModule(tempDir);
  assert.deepEqual(slackB.getProposal('123.45'), {
    proposedPath: '/tmp/p.md',
    targetDir: '/tmp',
    fileName: 'p.md'
  });

  const indexPath = path.join(tempDir, 'proposed', 'index.json');
  assert.equal(fs.existsSync(indexPath), true);
});
