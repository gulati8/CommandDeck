'use strict';

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

function freshThreadModule(tempDir) {
  process.env.COMMANDDECK_STATE_DIR = tempDir;
  delete require.cache[require.resolve('../lib/thread')];
  return require('../lib/thread');
}

describe('thread', () => {
  let tempDir;

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    delete process.env.COMMANDDECK_STATE_DIR;
  });

  describe('thread tracking CRUD', () => {
    it('should track and retrieve a thread', () => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'commanddeck-thread-'));
      const mod = freshThreadModule(tempDir);

      mod.trackThread('C123', '111.222', {
        repo: 'TestRepo',
        mission_id: 'mission-001',
        integration_branch: 'commanddeck/mission-001/integration',
        pr_number: 42,
        pr_url: 'https://github.com/test/repo/pull/42',
        original_description: 'Add feature X'
      });

      const t = mod.getThread('C123', '111.222');
      assert.equal(t.repo, 'TestRepo');
      assert.equal(t.mission_id, 'mission-001');
      assert.equal(t.integration_branch, 'commanddeck/mission-001/integration');
      assert.equal(t.pr_number, 42);
      assert.equal(t.status, 'idle');
      assert.equal(t.follow_up_count, 0);
      assert.ok(t.tracked_at);
    });

    it('should return null for untracked thread', () => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'commanddeck-thread-'));
      const mod = freshThreadModule(tempDir);

      assert.equal(mod.getThread('C999', '999.999'), null);
    });

    it('should update thread status', () => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'commanddeck-thread-'));
      const mod = freshThreadModule(tempDir);

      mod.trackThread('C123', '111.222', {
        repo: 'TestRepo',
        mission_id: 'mission-001',
        integration_branch: 'int-branch',
        pr_number: 1,
        pr_url: 'https://example.com/pull/1',
        original_description: 'task'
      });

      mod.updateThreadStatus('C123', '111.222', 'assessing');
      assert.equal(mod.getThread('C123', '111.222').status, 'assessing');

      mod.updateThreadStatus('C123', '111.222', 'working');
      assert.equal(mod.getThread('C123', '111.222').status, 'working');

      mod.updateThreadStatus('C123', '111.222', 'idle');
      assert.equal(mod.getThread('C123', '111.222').status, 'idle');
    });

    it('should increment follow-up count', () => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'commanddeck-thread-'));
      const mod = freshThreadModule(tempDir);

      mod.trackThread('C123', '111.222', {
        repo: 'TestRepo',
        mission_id: 'mission-001',
        integration_branch: 'int-branch',
        pr_number: 1,
        pr_url: 'https://example.com/pull/1',
        original_description: 'task'
      });

      mod.incrementFollowUp('C123', '111.222');
      assert.equal(mod.getThread('C123', '111.222').follow_up_count, 1);

      mod.incrementFollowUp('C123', '111.222');
      assert.equal(mod.getThread('C123', '111.222').follow_up_count, 2);
    });

    it('should remove a thread', () => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'commanddeck-thread-'));
      const mod = freshThreadModule(tempDir);

      mod.trackThread('C123', '111.222', {
        repo: 'TestRepo',
        mission_id: 'mission-001',
        integration_branch: 'int-branch',
        pr_number: 1,
        pr_url: 'https://example.com/pull/1',
        original_description: 'task'
      });

      assert.ok(mod.getThread('C123', '111.222'));
      mod.removeThread('C123', '111.222');
      assert.equal(mod.getThread('C123', '111.222'), null);
    });

    it('should persist to disk across module reloads', () => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'commanddeck-thread-'));
      const modA = freshThreadModule(tempDir);

      modA.trackThread('C123', '111.222', {
        repo: 'TestRepo',
        mission_id: 'mission-001',
        integration_branch: 'int-branch',
        pr_number: 1,
        pr_url: 'https://example.com/pull/1',
        original_description: 'task'
      });

      // Reload module — data should persist from disk
      const modB = freshThreadModule(tempDir);
      const t = modB.getThread('C123', '111.222');
      assert.equal(t.repo, 'TestRepo');
      assert.equal(t.mission_id, 'mission-001');

      // Verify file exists
      assert.ok(fs.existsSync(path.join(tempDir, 'active-threads.json')));
    });

    it('should reset stale assessing threads on startup', () => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'commanddeck-thread-'));
      const mod = freshThreadModule(tempDir);

      mod.trackThread('C123', '111.222', {
        repo: 'TestRepo',
        mission_id: 'mission-001',
        integration_branch: 'int-branch',
        pr_number: 1,
        pr_url: 'https://example.com/pull/1',
        original_description: 'task'
      });

      mod.updateThreadStatus('C123', '111.222', 'assessing');
      assert.equal(mod.getThread('C123', '111.222').status, 'assessing');

      mod.resetStaleThreads();
      assert.equal(mod.getThread('C123', '111.222').status, 'idle');
    });

    it('should not reset working threads on startup recovery', () => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'commanddeck-thread-'));
      const mod = freshThreadModule(tempDir);

      mod.trackThread('C123', '111.222', {
        repo: 'TestRepo',
        mission_id: 'mission-001',
        integration_branch: 'int-branch',
        pr_number: 1,
        pr_url: 'https://example.com/pull/1',
        original_description: 'task'
      });

      mod.updateThreadStatus('C123', '111.222', 'working');
      mod.resetStaleThreads();
      // working status should NOT be reset (only assessing is stale)
      assert.equal(mod.getThread('C123', '111.222').status, 'working');
    });
  });

  describe('debounce', () => {
    it('should batch messages within the debounce window', (t, done) => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'commanddeck-thread-'));
      const mod = freshThreadModule(tempDir);

      const collected = [];

      mod.debounce('C123', '111.222', 'message 1', (msgs) => {
        collected.push(...msgs);
      });
      mod.debounce('C123', '111.222', 'message 2', (msgs) => {
        collected.push(...msgs);
        // After debounce fires, should have both messages
        assert.deepEqual(collected, ['message 1', 'message 2']);
        done();
      });
    });

    it('should keep separate debounce timers per thread', (t, done) => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'commanddeck-thread-'));
      const mod = freshThreadModule(tempDir);

      let callCount = 0;

      mod.debounce('C123', '111.222', 'thread 1 msg', (msgs) => {
        assert.deepEqual(msgs, ['thread 1 msg']);
        callCount++;
        if (callCount === 2) done();
      });

      mod.debounce('C456', '333.444', 'thread 2 msg', (msgs) => {
        assert.deepEqual(msgs, ['thread 2 msg']);
        callCount++;
        if (callCount === 2) done();
      });
    });
  });

  describe('parseClassification', () => {
    it('should parse valid work classification', () => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'commanddeck-thread-'));
      const mod = freshThreadModule(tempDir);

      const result = mod.parseClassification(JSON.stringify({
        action: 'work',
        message: 'I understand, making the change now.',
        task_description: 'Fix the button color to blue'
      }));

      assert.equal(result.action, 'work');
      assert.equal(result.message, 'I understand, making the change now.');
      assert.equal(result.task_description, 'Fix the button color to blue');
    });

    it('should parse converse classification', () => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'commanddeck-thread-'));
      const mod = freshThreadModule(tempDir);

      const result = mod.parseClassification(JSON.stringify({
        action: 'converse',
        message: 'What kind of auth are you thinking about?'
      }));

      assert.equal(result.action, 'converse');
      assert.ok(result.message.includes('auth'));
      assert.equal(result.task_description, null);
    });

    it('should parse inquiry classification', () => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'commanddeck-thread-'));
      const mod = freshThreadModule(tempDir);

      const result = mod.parseClassification(JSON.stringify({
        action: 'inquiry',
        message: 'The test suite currently has 95% coverage.'
      }));

      assert.equal(result.action, 'inquiry');
    });

    it('should parse JSON embedded in surrounding text', () => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'commanddeck-thread-'));
      const mod = freshThreadModule(tempDir);

      const result = mod.parseClassification(
        'Here is my assessment:\n' +
        '{"action": "work", "message": "Got it.", "task_description": "Build the login page"}\n' +
        'End.'
      );

      assert.equal(result.action, 'work');
      assert.equal(result.task_description, 'Build the login page');
    });

    it('should fallback to converse on malformed JSON', () => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'commanddeck-thread-'));
      const mod = freshThreadModule(tempDir);

      const result = mod.parseClassification('this is not json at all');
      assert.equal(result.action, 'converse');
    });

    it('should fallback to converse on empty/null input', () => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'commanddeck-thread-'));
      const mod = freshThreadModule(tempDir);

      assert.equal(mod.parseClassification('').action, 'converse');
      assert.equal(mod.parseClassification(null).action, 'converse');
      assert.equal(mod.parseClassification(undefined).action, 'converse');
    });

    it('should fallback to converse on invalid action', () => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'commanddeck-thread-'));
      const mod = freshThreadModule(tempDir);

      const noAction = mod.parseClassification(JSON.stringify({
        message: 'No action field here'
      }));
      assert.equal(noAction.action, 'converse');

      const badAction = mod.parseClassification(JSON.stringify({
        action: 'invalid',
        message: 'Bad action value'
      }));
      assert.equal(badAction.action, 'converse');
    });

    it('should handle JSON with extra whitespace', () => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'commanddeck-thread-'));
      const mod = freshThreadModule(tempDir);

      const result = mod.parseClassification(`
        {
          "action": "inquiry",
          "message": "Got it, thanks!"
        }
      `);

      assert.equal(result.action, 'inquiry');
      assert.equal(result.message, 'Got it, thanks!');
    });
  });

  describe('resetStaleThreads with conversing threads', () => {
    it('should reset assessing pre-mission threads to conversing', () => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'commanddeck-thread-'));
      const mod = freshThreadModule(tempDir);

      mod.trackThread('C123', '111.222', {
        repo: 'TestRepo',
        mission_id: null,
        original_description: 'thinking about auth',
        status: 'conversing'
      });

      mod.updateThreadStatus('C123', '111.222', 'assessing');
      assert.equal(mod.getThread('C123', '111.222').status, 'assessing');

      mod.resetStaleThreads();
      // No mission_id → resets to conversing, not idle
      assert.equal(mod.getThread('C123', '111.222').status, 'conversing');
    });

    it('should reset launching threads to conversing', () => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'commanddeck-thread-'));
      const mod = freshThreadModule(tempDir);

      mod.trackThread('C123', '111.222', {
        repo: 'TestRepo',
        mission_id: null,
        original_description: 'add auth',
        status: 'launching'
      });

      mod.resetStaleThreads();
      assert.equal(mod.getThread('C123', '111.222').status, 'conversing');
    });
  });

  describe('pre-mission thread tracking', () => {
    it('should track conversing threads with null mission fields', () => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'commanddeck-thread-'));
      const mod = freshThreadModule(tempDir);

      mod.trackThread('C123', '111.222', {
        repo: 'TestRepo',
        mission_id: null,
        original_description: 'thinking about improvements',
        status: 'conversing'
      });

      const t = mod.getThread('C123', '111.222');
      assert.equal(t.status, 'conversing');
      assert.equal(t.repo, 'TestRepo');
      assert.equal(t.mission_id, null);
      assert.equal(t.pr_number, undefined);
    });
  });
});
