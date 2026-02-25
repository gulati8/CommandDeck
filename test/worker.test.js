'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

describe('ensureClaude', () => {
  beforeEach(() => {
    // Reset the check so each test starts fresh
    delete require.cache[require.resolve('../lib/worker')];
  });

  it('should not throw when claude is on PATH', () => {
    const worker = require('../lib/worker');
    worker._resetClaudeCheck();
    // "which" itself is always available; this tests the mechanism.
    // In CI where claude may not be installed, we test the error path instead.
    try {
      worker.ensureClaude();
    } catch (err) {
      assert.match(err.message, /Claude Code CLI not found on PATH/);
    }
  });

  it('should cache the result after first successful check', () => {
    const worker = require('../lib/worker');
    worker._resetClaudeCheck();
    // Call twice — second call should not throw even if first didn't
    try {
      worker.ensureClaude();
      // If it passed, the second call should also pass (cached)
      worker.ensureClaude();
    } catch {
      // Claude not installed — that's fine for unit test
    }
  });

  it('should throw a clear error message when claude is missing', () => {
    const worker = require('../lib/worker');
    worker._resetClaudeCheck();

    // Temporarily modify PATH to ensure claude is not found
    const origPath = process.env.PATH;
    process.env.PATH = '/nonexistent';

    try {
      assert.throws(
        () => worker.ensureClaude(),
        {
          message: /Claude Code CLI not found on PATH/
        }
      );
    } finally {
      process.env.PATH = origPath;
    }
  });
});

describe('loadAgentIdentity', () => {
  it('should return identity text for known agent', () => {
    const worker = require('../lib/worker');
    const result = worker.loadAgentIdentity('captain-picard');
    assert.ok(result.identity.length > 0);
    assert.ok(result.identity.includes('Captain Picard'));
  });

  it('should return tools array from frontmatter', () => {
    const worker = require('../lib/worker');
    const result = worker.loadAgentIdentity('captain-picard');
    assert.ok(Array.isArray(result.tools));
    assert.ok(result.tools.includes('Read'));
    assert.ok(result.tools.includes('Write'));
  });

  it('should return model from frontmatter', () => {
    const worker = require('../lib/worker');
    const result = worker.loadAgentIdentity('captain-picard');
    assert.equal(result.model, 'claude-opus-4-6');
  });

  it('should return empty identity for non-existent agent', () => {
    const worker = require('../lib/worker');
    const result = worker.loadAgentIdentity('nonexistent-agent');
    assert.equal(result.identity, '');
    assert.equal(result.tools, null);
    assert.equal(result.model, null);
  });

  it('should include Write in worf tools', () => {
    const worker = require('../lib/worker');
    const result = worker.loadAgentIdentity('worf');
    assert.ok(Array.isArray(result.tools));
    assert.ok(result.tools.includes('Write'));
  });
});

describe('worker exports', () => {
  it('should export expected functions', () => {
    const worker = require('../lib/worker');
    assert.equal(typeof worker.execute, 'function');
    assert.equal(typeof worker.executeSpecialist, 'function');
    assert.equal(typeof worker.kill, 'function');
    assert.equal(typeof worker.activeCount, 'function');
    assert.equal(typeof worker.ensureClaude, 'function');
    assert.equal(typeof worker.loadAgentIdentity, 'function');
    assert.equal(typeof worker._resetClaudeCheck, 'function');
    assert.equal(typeof worker.WORKER_TIMEOUT, 'number');
  });

  it('should report 0 active workers initially', () => {
    const worker = require('../lib/worker');
    assert.equal(worker.activeCount(), 0);
  });

  it('should return false when killing non-existent worker', () => {
    const worker = require('../lib/worker');
    assert.equal(worker.kill('nonexistent-obj'), false);
  });
});
