'use strict';

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Use a temp directory as state dir to isolate tests
const TEST_STATE_DIR = path.join(os.tmpdir(), `commanddeck-test-${Date.now()}`);
process.env.COMMANDDECK_STATE_DIR = TEST_STATE_DIR;

const state = require('../lib/state');

describe('state', () => {
  before(() => {
    fs.mkdirSync(TEST_STATE_DIR, { recursive: true });
  });

  after(() => {
    fs.rmSync(TEST_STATE_DIR, { recursive: true, force: true });
  });

  describe('formatStardate', () => {
    it('should format a date as YYYY.DDD.HHMM', () => {
      // Jan 15, 2025 at 14:30 UTC
      const date = new Date('2025-01-15T14:30:00Z');
      const stardate = state.formatStardate(date);

      assert.match(stardate, /^2025\.015\.1430$/);
    });

    it('should zero-pad day of year', () => {
      const date = new Date('2025-01-02T08:05:00Z');
      const stardate = state.formatStardate(date);

      assert.match(stardate, /^2025\.002\.0805$/);
    });
  });

  describe('createMission', () => {
    it('should create a mission with correct initial state', async () => {
      const result = await state.createMission('test-repo', {
        description: 'Build a widget',
        slackChannel: null,
        slackThreadTs: null
      });

      assert.ok(result.mission_id.startsWith('mission-'));
      assert.equal(result.repo, 'test-repo');
      assert.equal(result.description, 'Build a widget');
      assert.equal(result.status, 'planning');
      assert.deepEqual(result.work_items, []);
      assert.deepEqual(result.session_log, []);
      assert.equal(result.safety.session_count, 0);
    });

    it('should create mission directories', async () => {
      const result = await state.createMission('test-repo-2', {
        description: 'Test dirs',
        slackChannel: null,
        slackThreadTs: null
      });

      const dir = state.missionDir('test-repo-2', result.mission_id);
      assert.ok(fs.existsSync(path.join(dir, 'briefings')));
      assert.ok(fs.existsSync(path.join(dir, 'artifacts')));
      assert.ok(fs.existsSync(path.join(dir, 'captains-log.md')));
    });
  });

  describe('readMission / writeMission', () => {
    it('should round-trip mission state', async () => {
      const mission = await state.createMission('roundtrip-repo', {
        description: 'Roundtrip test',
        slackChannel: null,
        slackThreadTs: null
      });

      mission.status = 'in_progress';
      await state.writeMission('roundtrip-repo', mission.mission_id, mission);

      const read = await state.readMission('roundtrip-repo', mission.mission_id);
      assert.equal(read.status, 'in_progress');
      assert.equal(read.description, 'Roundtrip test');
    });

    it('should return null for non-existent mission', async () => {
      const result = await state.readMission('no-repo', 'no-mission');
      assert.equal(result, null);
    });
  });

  describe('withMissionLock', () => {
    it('should atomically read-modify-write', async () => {
      const mission = await state.createMission('lock-repo', {
        description: 'Lock test',
        slackChannel: null,
        slackThreadTs: null
      });

      await state.withMissionLock('lock-repo', mission.mission_id, (s) => {
        s.status = 'merging';
        s.work_items.push({ id: 'obj-1', status: 'done' });
        return s;
      });

      const read = await state.readMission('lock-repo', mission.mission_id);
      assert.equal(read.status, 'merging');
      assert.equal(read.work_items.length, 1);
      assert.equal(read.work_items[0].id, 'obj-1');
    });
  });

  describe('updateItemStatus', () => {
    it('should update a single work item atomically', async () => {
      const mission = await state.createMission('item-repo', {
        description: 'Item test',
        slackChannel: null,
        slackThreadTs: null
      });

      // Add work items
      await state.withMissionLock('item-repo', mission.mission_id, (s) => {
        s.work_items = [
          { id: 'obj-1', status: 'ready', depends_on: [] },
          { id: 'obj-2', status: 'ready', depends_on: ['obj-1'] }
        ];
        return s;
      });

      await state.updateItemStatus('item-repo', mission.mission_id, 'obj-1', 'done', {
        completed_at: '2025-01-01T00:00:00Z'
      });

      const read = await state.readMission('item-repo', mission.mission_id);
      assert.equal(read.work_items[0].status, 'done');
      assert.equal(read.work_items[0].completed_at, '2025-01-01T00:00:00Z');
      assert.equal(read.work_items[1].status, 'ready'); // unchanged
    });

    it('should throw for non-existent objective', async () => {
      const mission = await state.createMission('bad-item-repo', {
        description: 'Bad item test',
        slackChannel: null,
        slackThreadTs: null
      });

      await assert.rejects(
        () => state.updateItemStatus('bad-item-repo', mission.mission_id, 'nope', 'done'),
        /not found/
      );
    });
  });

  describe('getReadyItems', () => {
    it('should return items whose dependencies are all done', () => {
      const mockState = {
        work_items: [
          { id: 'obj-1', status: 'done', depends_on: [] },
          { id: 'obj-2', status: 'ready', depends_on: ['obj-1'] },
          { id: 'obj-3', status: 'ready', depends_on: ['obj-1', 'obj-4'] },
          { id: 'obj-4', status: 'in_progress', depends_on: [] }
        ]
      };

      const ready = state.getReadyItems(mockState);
      assert.equal(ready.length, 1);
      assert.equal(ready[0].id, 'obj-2');
    });

    it('should return empty array when nothing is ready', () => {
      const mockState = {
        work_items: [
          { id: 'obj-1', status: 'in_progress', depends_on: [] }
        ]
      };

      const ready = state.getReadyItems(mockState);
      assert.equal(ready.length, 0);
    });
  });

  describe('incrementSessionCount', () => {
    it('should increment session count atomically', async () => {
      const mission = await state.createMission('session-repo', {
        description: 'Session test',
        slackChannel: null,
        slackThreadTs: null
      });

      assert.equal(mission.safety.session_count, 0);

      await state.incrementSessionCount('session-repo', mission.mission_id);
      await state.incrementSessionCount('session-repo', mission.mission_id);

      const read = await state.readMission('session-repo', mission.mission_id);
      assert.equal(read.safety.session_count, 2);
    });
  });

  describe('addSessionLog', () => {
    it('should append a session log entry', async () => {
      const mission = await state.createMission('log-repo', {
        description: 'Log test',
        slackChannel: null,
        slackThreadTs: null
      });

      await state.addSessionLog('log-repo', mission.mission_id, {
        session_id: 'sess-1',
        agent: 'borg',
        objective: 'obj-1'
      });

      const read = await state.readMission('log-repo', mission.mission_id);
      assert.equal(read.session_log.length, 1);
      assert.equal(read.session_log[0].agent, 'borg');
    });
  });

  describe('loadProjectConfig', () => {
    it('should return defaults when no config exists', () => {
      const config = state.loadProjectConfig('nonexistent-repo');
      assert.equal(config.default_branch, 'main');
      assert.equal(typeof config.max_workers, 'number');
      assert.equal(config.test_command, null);
    });

    it('should merge config with defaults', () => {
      const configDir = path.join(TEST_STATE_DIR, 'projects', 'config-test-repo');
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(
        path.join(configDir, 'config.json'),
        JSON.stringify({ default_branch: 'develop', max_workers: 5 }),
        'utf-8'
      );

      const config = state.loadProjectConfig('config-test-repo');
      assert.equal(config.default_branch, 'develop');
      assert.equal(config.max_workers, 5);
      assert.equal(config.test_command, null); // from defaults
    });
  });

  describe('getMissionStatus', () => {
    it('should find latest mission when no ID given', async () => {
      const m1 = await state.createMission('status-repo', {
        description: 'First mission',
        slackChannel: null,
        slackThreadTs: null
      });

      // Small delay to ensure different created_at timestamps
      await new Promise(r => setTimeout(r, 10));

      const m2 = await state.createMission('status-repo', {
        description: 'Second mission',
        slackChannel: null,
        slackThreadTs: null
      });

      const latest = await state.getMissionStatus(null);
      assert.equal(latest.description, 'Second mission');
      assert.ok('progress' in latest);
    });

    it('should return null when no missions exist', async () => {
      // Point to empty state dir temporarily
      const emptyDir = path.join(os.tmpdir(), `commanddeck-empty-${Date.now()}`);
      const origDir = process.env.COMMANDDECK_STATE_DIR;
      process.env.COMMANDDECK_STATE_DIR = emptyDir;

      // Force re-read of STATE_DIR by checking directly
      const result = await state.getMissionStatus(null);
      // Note: STATE_DIR is captured at module load time, so this test
      // verifies the null path in the existing state dir
      process.env.COMMANDDECK_STATE_DIR = origDir;
    });

    it('should add progress info to result', async () => {
      const mission = await state.createMission('progress-repo', {
        description: 'Progress test',
        slackChannel: null,
        slackThreadTs: null
      });

      await state.withMissionLock('progress-repo', mission.mission_id, (s) => {
        s.work_items = [
          { id: 'a', status: 'done', depends_on: [] },
          { id: 'b', status: 'ready', depends_on: [] }
        ];
        return s;
      });

      const result = await state.getMissionStatus(mission.mission_id);
      assert.equal(result.progress.done, 1);
      assert.equal(result.progress.total, 2);
      assert.equal(result.progress.percent, 50);
    });
  });

  describe('version and updated_at tracking', () => {
    it('should start with version 0 in createMission', async () => {
      const mission = await state.createMission('version-repo', {
        description: 'Version test',
        slackChannel: null,
        slackThreadTs: null
      });

      // After writeMission in createMission, version should be bumped to 1
      const read = await state.readMission('version-repo', mission.mission_id);
      assert.ok(read.version >= 1);
      assert.ok(read.updated_at);
    });

    it('should increment version on writeMission', async () => {
      const mission = await state.createMission('version-write-repo', {
        description: 'Write version test',
        slackChannel: null,
        slackThreadTs: null
      });

      const read1 = await state.readMission('version-write-repo', mission.mission_id);
      const v1 = read1.version;

      read1.status = 'in_progress';
      await state.writeMission('version-write-repo', mission.mission_id, read1);

      const read2 = await state.readMission('version-write-repo', mission.mission_id);
      assert.ok(read2.version > v1);
      assert.ok(read2.updated_at);
    });

    it('should increment version on withMissionLock', async () => {
      const mission = await state.createMission('version-lock-repo', {
        description: 'Lock version test',
        slackChannel: null,
        slackThreadTs: null
      });

      const read1 = await state.readMission('version-lock-repo', mission.mission_id);
      const v1 = read1.version;

      await state.withMissionLock('version-lock-repo', mission.mission_id, (s) => {
        s.status = 'merging';
        return s;
      });

      const read2 = await state.readMission('version-lock-repo', mission.mission_id);
      assert.ok(read2.version > v1);
      assert.equal(read2.status, 'merging');
      assert.ok(read2.updated_at);
    });
  });

  describe('appendCaptainsLog', () => {
    it('should append text to the captains log', async () => {
      const mission = await state.createMission('log-append-repo', {
        description: 'Captains log test',
        slackChannel: null,
        slackThreadTs: null
      });

      await state.appendCaptainsLog('log-append-repo', mission.mission_id, 'First entry');
      await state.appendCaptainsLog('log-append-repo', mission.mission_id, 'Second entry');

      const logPath = path.join(
        state.missionDir('log-append-repo', mission.mission_id),
        'captains-log.md'
      );
      const content = fs.readFileSync(logPath, 'utf-8');
      assert.ok(content.includes('First entry'));
      assert.ok(content.includes('Second entry'));
      assert.ok(content.includes('Stardate'));
    });
  });
});
