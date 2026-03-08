'use strict';

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const db = require('../lib/db');

function freshThreadModule(tempDir) {
  process.env.COMMANDDECK_STATE_DIR = tempDir;
  db.close();
  db.getDb();
  delete require.cache[require.resolve('../lib/thread')];
  return require('../lib/thread');
}

describe('thread', () => {
  let tempDir;

  afterEach(() => {
    db.close();
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

    it('should persist across module reloads (SQLite)', () => {
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

      // Reload module — data should persist from SQLite
      const modB = freshThreadModule(tempDir);
      const t = modB.getThread('C123', '111.222');
      assert.equal(t.repo, 'TestRepo');
      assert.equal(t.mission_id, 'mission-001');

      // Verify SQLite db exists
      assert.ok(fs.existsSync(path.join(tempDir, 'state.db')));
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
    it('should parse valid JSON with work action', () => {
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

    it('should parse JSON embedded in surrounding text', () => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'commanddeck-thread-'));
      const mod = freshThreadModule(tempDir);

      const result = mod.parseClassification(
        'Here is my classification:\n' +
        '{"action": "converse", "message": "Could you clarify what you mean?", "task_description": null}\n' +
        'End of classification.'
      );

      assert.equal(result.action, 'converse');
      assert.equal(result.message, 'Could you clarify what you mean?');
    });

    it('should fallback on malformed JSON', () => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'commanddeck-thread-'));
      const mod = freshThreadModule(tempDir);

      const result = mod.parseClassification('this is not json at all');

      assert.equal(result.action, 'converse');
      assert.ok(result.message.includes('help'));
    });

    it('should fallback on empty/null input', () => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'commanddeck-thread-'));
      const mod = freshThreadModule(tempDir);

      assert.equal(mod.parseClassification('').action, 'converse');
      assert.equal(mod.parseClassification(null).action, 'converse');
      assert.equal(mod.parseClassification(undefined).action, 'converse');
    });

    it('should fallback on missing or invalid action', () => {
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

    it('should accept all valid actions', () => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'commanddeck-thread-'));
      const mod = freshThreadModule(tempDir);

      for (const action of ['work', 'converse', 'inquiry']) {
        const result = mod.parseClassification(JSON.stringify({ action, message: 'test' }));
        assert.equal(result.action, action);
      }
    });
  });

  describe('pre-mission thread tracking', () => {
    it('should track a thread without a mission', () => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'commanddeck-thread-'));
      const mod = freshThreadModule(tempDir);

      mod.trackThread('C123', '111.222', {
        repo: 'TestRepo',
        status: 'conversing'
      });

      const t = mod.getThread('C123', '111.222');
      assert.equal(t.repo, 'TestRepo');
      assert.equal(t.status, 'conversing');
      assert.equal(t.mission_id, null);
    });

    it('should reset stale launching threads to conversing', () => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'commanddeck-thread-'));
      const mod = freshThreadModule(tempDir);

      mod.trackThread('C123', '111.222', {
        repo: 'TestRepo',
        status: 'launching'
      });

      mod.updateThreadStatus('C123', '111.222', 'launching');
      mod.resetStaleThreads();
      assert.equal(mod.getThread('C123', '111.222').status, 'conversing');
    });

    it('should reset stale assessing pre-mission threads to conversing', () => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'commanddeck-thread-'));
      const mod = freshThreadModule(tempDir);

      mod.trackThread('C123', '111.222', {
        repo: 'TestRepo',
        status: 'conversing'
      });

      mod.updateThreadStatus('C123', '111.222', 'assessing');
      mod.resetStaleThreads();
      assert.equal(mod.getThread('C123', '111.222').status, 'conversing');
    });
  });
});
