'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const { getMinutesSinceActivity } = require('../lib/health');

describe('getMinutesSinceActivity', () => {
  it('should measure from worker start when last commit predates it', () => {
    // Create a temp git repo with an old commit
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'health-test-'));
    execFileSync('git', ['init'], { cwd: tmpDir, stdio: 'pipe' });
    execFileSync('git', ['config', 'user.email', 'test@test.com'], { cwd: tmpDir, stdio: 'pipe' });
    execFileSync('git', ['config', 'user.name', 'Test'], { cwd: tmpDir, stdio: 'pipe' });
    fs.writeFileSync(path.join(tmpDir, 'file.txt'), 'hello');
    execFileSync('git', ['add', '.'], { cwd: tmpDir, stdio: 'pipe' });
    // Commit with a date 30 days ago
    const oldDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    execFileSync('git', ['commit', '-m', 'old commit', '--date', oldDate], {
      cwd: tmpDir,
      stdio: 'pipe',
      env: { ...process.env, GIT_COMMITTER_DATE: oldDate }
    });

    // Worker started 5 minutes ago — should measure from start, not old commit
    const startedAt = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const minutes = getMinutesSinceActivity(tmpDir, startedAt);

    // Should be ~5 minutes (from worker start), not ~43200 minutes (from old commit)
    assert.ok(minutes < 10, `Expected <10 minutes, got ${minutes}`);
    assert.ok(minutes >= 4, `Expected >=4 minutes, got ${minutes}`);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should measure from commit when worker has committed recently', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'health-test-'));
    execFileSync('git', ['init'], { cwd: tmpDir, stdio: 'pipe' });
    execFileSync('git', ['config', 'user.email', 'test@test.com'], { cwd: tmpDir, stdio: 'pipe' });
    execFileSync('git', ['config', 'user.name', 'Test'], { cwd: tmpDir, stdio: 'pipe' });
    fs.writeFileSync(path.join(tmpDir, 'file.txt'), 'hello');
    execFileSync('git', ['add', '.'], { cwd: tmpDir, stdio: 'pipe' });
    execFileSync('git', ['commit', '-m', 'recent commit'], { cwd: tmpDir, stdio: 'pipe' });

    // Worker started 30 minutes ago but committed just now
    const startedAt = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const minutes = getMinutesSinceActivity(tmpDir, startedAt);

    // Should be ~0 minutes (from recent commit), not 30 (from worker start)
    assert.ok(minutes < 2, `Expected <2 minutes, got ${minutes}`);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should fall back to worker start when no git repo exists', () => {
    const startedAt = new Date(Date.now() - 7 * 60 * 1000).toISOString();
    const minutes = getMinutesSinceActivity('/nonexistent/path', startedAt);

    assert.ok(minutes < 10, `Expected <10 minutes, got ${minutes}`);
    assert.ok(minutes >= 6, `Expected >=6 minutes, got ${minutes}`);
  });

  it('should return 999 when no git repo and no started_at', () => {
    const minutes = getMinutesSinceActivity('/nonexistent/path', undefined);
    assert.equal(minutes, 999);
  });
});
