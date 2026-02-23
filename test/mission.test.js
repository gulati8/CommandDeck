'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { shouldOpenPR } = require('../lib/mission');

describe('shouldOpenPR', () => {
  it('should return true when mission is merging and all items are done', () => {
    assert.equal(
      shouldOpenPR({ status: 'merging', work_items: [{ status: 'done' }, { status: 'done' }] }),
      true
    );
  });

  it('should return false when mission is not merging', () => {
    assert.equal(
      shouldOpenPR({ status: 'paused', work_items: [{ status: 'done' }] }),
      false
    );
  });

  it('should return false when some items are not done', () => {
    assert.equal(
      shouldOpenPR({ status: 'merging', work_items: [{ status: 'done' }, { status: 'ready' }] }),
      false
    );
  });

  it('should return false for null state', () => {
    assert.equal(shouldOpenPR(null), false);
  });
});

describe('decompose retry', () => {
  it('should retry readMission when work_items is initially empty', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'commanddeck-decompose-'));
    const oldStateDir = process.env.COMMANDDECK_STATE_DIR;
    const oldProjectDir = process.env.COMMANDDECK_PROJECT_DIR;
    try {
      process.env.COMMANDDECK_STATE_DIR = tempDir;
      // Create a fake project directory so start() validation passes
      const projectDir = path.join(tempDir, 'projects', 'retry-repo');
      fs.mkdirSync(projectDir, { recursive: true });
      process.env.COMMANDDECK_PROJECT_DIR = path.join(tempDir, 'projects');

      delete require.cache[require.resolve('../lib/state')];
      delete require.cache[require.resolve('../lib/mission')];
      delete require.cache[require.resolve('../lib/worker')];
      delete require.cache[require.resolve('../lib/worktree')];
      const stateModule = require('../lib/state');
      const { Mission } = require('../lib/mission');

      const missionState = await stateModule.createMission('retry-repo', {
        description: 'retry test',
        slackChannel: null,
        slackThreadTs: null
      });

      const mission = new Mission('retry-repo', 'test task', {
        reporter: { post: async () => {} }
      });

      // Stub decompose to simulate Picard writing work_items after a delay.
      // The delay simulates filesystem sync lag after Picard writes.
      // Use mission.missionId (set by start() before decompose is called).
      mission.decompose = async () => {
        setTimeout(async () => {
          await stateModule.withMissionLock('retry-repo', mission.missionId, (s) => {
            s.work_items = [
              { id: 'obj-1', title: 'Test', status: 'ready', depends_on: [], phase: 1 }
            ];
            return s;
          });
        }, 200);
      };

      // Stub other lifecycle methods
      mission.reportPlan = async () => {};
      mission.setStatus = async (status) => { mission.state.status = status; };
      mission.ensureIntegrationBranch = () => {};
      mission.workLoop = async () => 'done';

      await mission.start();

      // Verify that the retry found the work_items
      assert.ok(mission.state.work_items.length > 0, 'Should have found work_items after retry');
    } finally {
      process.env.COMMANDDECK_STATE_DIR = oldStateDir;
      process.env.COMMANDDECK_PROJECT_DIR = oldProjectDir;
    }
  });
});

describe('resume', () => {
  it('should persist checkpoint objective completion to mission state', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'commanddeck-mission-'));
    const oldStateDir = process.env.COMMANDDECK_STATE_DIR;
    try {
      process.env.COMMANDDECK_STATE_DIR = tempDir;

      delete require.cache[require.resolve('../lib/state')];
      delete require.cache[require.resolve('../lib/mission')];
      const state = require('../lib/state');
      const { Mission } = require('../lib/mission');

      const missionState = await state.createMission('resume-repo', {
        description: 'resume test',
        slackChannel: null,
        slackThreadTs: null
      });

      await state.withMissionLock('resume-repo', missionState.mission_id, (s) => {
        s.status = 'checkpoint_paused';
        s.work_items = [
          { id: 'obj-1', title: 'checkpoint', status: 'checkpoint_paused', depends_on: [] }
        ];
        return s;
      });

      const mission = new Mission('resume-repo', '', { reporter: { post: async () => {} } });
      mission.missionId = missionState.mission_id;
      mission.workLoop = async () => 'done';

      await mission.resume();

      const updated = await state.readMission('resume-repo', missionState.mission_id);
      assert.equal(updated.work_items[0].status, 'done');
      assert.ok(updated.work_items[0].completed_at);
    } finally {
      process.env.COMMANDDECK_STATE_DIR = oldStateDir;
    }
  });
});
