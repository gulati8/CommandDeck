'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('ensureSshRemote', () => {
  let tempDir;

  before(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'commanddeck-worktree-'));
    execFileSync('git', ['init', tempDir], { stdio: 'pipe' });
  });

  after(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should convert HTTPS GitHub remote to SSH', () => {
    const { ensureSshRemote } = require('../lib/worktree');
    execFileSync('git', ['remote', 'add', 'origin', 'https://github.com/gulati8/Leonid.git'], { cwd: tempDir, stdio: 'pipe' });
    ensureSshRemote(tempDir);
    const url = execFileSync('git', ['remote', 'get-url', 'origin'], { cwd: tempDir, encoding: 'utf-8' }).trim();
    assert.equal(url, 'git@github.com:gulati8/Leonid.git');
    // Clean up for next test
    execFileSync('git', ['remote', 'remove', 'origin'], { cwd: tempDir, stdio: 'pipe' });
  });

  it('should handle HTTPS URL without .git suffix', () => {
    const { ensureSshRemote } = require('../lib/worktree');
    execFileSync('git', ['remote', 'add', 'origin', 'https://github.com/gulati8/Leonid'], { cwd: tempDir, stdio: 'pipe' });
    ensureSshRemote(tempDir);
    const url = execFileSync('git', ['remote', 'get-url', 'origin'], { cwd: tempDir, encoding: 'utf-8' }).trim();
    assert.equal(url, 'git@github.com:gulati8/Leonid.git');
    execFileSync('git', ['remote', 'remove', 'origin'], { cwd: tempDir, stdio: 'pipe' });
  });

  it('should leave SSH remotes unchanged', () => {
    const { ensureSshRemote } = require('../lib/worktree');
    execFileSync('git', ['remote', 'add', 'origin', 'git@github.com:gulati8/Leonid.git'], { cwd: tempDir, stdio: 'pipe' });
    ensureSshRemote(tempDir);
    const url = execFileSync('git', ['remote', 'get-url', 'origin'], { cwd: tempDir, encoding: 'utf-8' }).trim();
    assert.equal(url, 'git@github.com:gulati8/Leonid.git');
    execFileSync('git', ['remote', 'remove', 'origin'], { cwd: tempDir, stdio: 'pipe' });
  });

  it('should not throw when no remote exists', () => {
    const { ensureSshRemote } = require('../lib/worktree');
    assert.doesNotThrow(() => ensureSshRemote(tempDir));
  });
});
