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
