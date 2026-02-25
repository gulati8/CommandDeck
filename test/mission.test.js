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

describe('objective count cap', () => {
  it('should abort mission if Picard creates too many objectives', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'commanddeck-cap-'));
    const oldStateDir = process.env.COMMANDDECK_STATE_DIR;
    const oldProjectDir = process.env.COMMANDDECK_PROJECT_DIR;
    try {
      process.env.COMMANDDECK_STATE_DIR = tempDir;
      const projectDir = path.join(tempDir, 'projects', 'cap-repo');
      fs.mkdirSync(projectDir, { recursive: true });
      process.env.COMMANDDECK_PROJECT_DIR = path.join(tempDir, 'projects');

      delete require.cache[require.resolve('../lib/state')];
      delete require.cache[require.resolve('../lib/mission')];
      delete require.cache[require.resolve('../lib/worker')];
      delete require.cache[require.resolve('../lib/worktree')];
      const stateModule = require('../lib/state');
      const { Mission } = require('../lib/mission');

      const missionState = await stateModule.createMission('cap-repo', {
        description: 'cap test',
        slackChannel: null,
        slackThreadTs: null
      });

      const mission = new Mission('cap-repo', 'test task', {
        reporter: { post: async () => {} }
      });

      // Stub decompose to produce 15 objectives (exceeds default max of 10)
      mission.decompose = async () => {
        await stateModule.withMissionLock('cap-repo', mission.missionId, (s) => {
          s.work_items = Array.from({ length: 15 }, (_, i) => ({
            id: `obj-${i + 1}`, title: `Task ${i + 1}`, status: 'ready',
            depends_on: [], phase: 1
          }));
          return s;
        });
      };

      mission.reportPlanForApproval = async () => null;
      mission.ensureIntegrationBranch = () => {};
      mission.workLoop = async () => 'done';

      const result = await mission.start();
      assert.equal(result.status, 'failed');
    } finally {
      process.env.COMMANDDECK_STATE_DIR = oldStateDir;
      process.env.COMMANDDECK_PROJECT_DIR = oldProjectDir;
    }
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
      mission.reportPlanForApproval = async () => null;
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
  it('should approve and run a pending_approval mission', async () => {
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
        s.status = 'pending_approval';
        s.work_items = [
          { id: 'obj-1', title: 'task', status: 'ready', depends_on: [] }
        ];
        return s;
      });

      const mission = new Mission('resume-repo', '', { reporter: { post: async () => {} } });
      mission.missionId = missionState.mission_id;
      mission.approvePlan = async () => { mission.state.status = 'merging'; };

      await mission.resume();

      assert.equal(mission.state.status, 'merging');
    } finally {
      process.env.COMMANDDECK_STATE_DIR = oldStateDir;
    }
  });

  it('should throw if mission is not pending_approval', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'commanddeck-mission-'));
    const oldStateDir = process.env.COMMANDDECK_STATE_DIR;
    try {
      process.env.COMMANDDECK_STATE_DIR = tempDir;

      delete require.cache[require.resolve('../lib/state')];
      delete require.cache[require.resolve('../lib/mission')];
      const state = require('../lib/state');
      const { Mission } = require('../lib/mission');

      const missionState = await state.createMission('resume-repo2', {
        description: 'wrong status',
        slackChannel: null,
        slackThreadTs: null
      });

      const mission = new Mission('resume-repo2', '', { reporter: { post: async () => {} } });
      mission.missionId = missionState.mission_id;

      await assert.rejects(() => mission.resume(), /not pending_approval/);
    } finally {
      process.env.COMMANDDECK_STATE_DIR = oldStateDir;
    }
  });
});

describe('rejectPlan', () => {
  it('should set mission status to aborted', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'commanddeck-mission-'));
    const oldStateDir = process.env.COMMANDDECK_STATE_DIR;
    try {
      process.env.COMMANDDECK_STATE_DIR = tempDir;

      delete require.cache[require.resolve('../lib/state')];
      delete require.cache[require.resolve('../lib/mission')];
      const state = require('../lib/state');
      const { Mission } = require('../lib/mission');

      const missionState = await state.createMission('reject-repo', {
        description: 'reject test',
        slackChannel: null,
        slackThreadTs: null
      });

      await state.withMissionLock('reject-repo', missionState.mission_id, (s) => {
        s.status = 'pending_approval';
        s.work_items = [
          { id: 'obj-1', title: 'task', status: 'ready', depends_on: [] }
        ];
        return s;
      });

      const mission = new Mission('reject-repo', '', { reporter: { post: async () => {} } });
      mission.missionId = missionState.mission_id;
      mission.state = await state.readMission('reject-repo', missionState.mission_id);

      await mission.rejectPlan();

      const updated = await state.readMission('reject-repo', missionState.mission_id);
      assert.equal(updated.status, 'aborted');
    } finally {
      process.env.COMMANDDECK_STATE_DIR = oldStateDir;
    }
  });
});

describe('start auto-approve', () => {
  it('should auto-approve when no channel (CLI mode)', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'commanddeck-auto-'));
    const oldStateDir = process.env.COMMANDDECK_STATE_DIR;
    const oldProjectDir = process.env.COMMANDDECK_PROJECT_DIR;
    try {
      process.env.COMMANDDECK_STATE_DIR = tempDir;
      const projectDir = path.join(tempDir, 'projects', 'auto-repo');
      fs.mkdirSync(projectDir, { recursive: true });
      process.env.COMMANDDECK_PROJECT_DIR = path.join(tempDir, 'projects');

      delete require.cache[require.resolve('../lib/state')];
      delete require.cache[require.resolve('../lib/mission')];
      delete require.cache[require.resolve('../lib/worker')];
      delete require.cache[require.resolve('../lib/worktree')];
      const stateModule = require('../lib/state');
      const { Mission } = require('../lib/mission');

      const mission = new Mission('auto-repo', 'test task', {
        reporter: { post: async () => null }
      });

      // Stub decompose to produce one objective
      mission.decompose = async () => {
        await stateModule.withMissionLock('auto-repo', mission.missionId, (s) => {
          s.work_items = [
            { id: 'obj-1', title: 'Test', status: 'ready', depends_on: [], phase: 1, assigned_to: 'borg' }
          ];
          return s;
        });
      };

      let approvedPlanCalled = false;
      mission.approvePlan = async () => {
        approvedPlanCalled = true;
        mission.state.status = 'merging';
      };

      const result = await mission.start();
      assert.ok(approvedPlanCalled, 'approvePlan should be called in CLI mode');
    } finally {
      process.env.COMMANDDECK_STATE_DIR = oldStateDir;
      process.env.COMMANDDECK_PROJECT_DIR = oldProjectDir;
    }
  });
});

describe('runMandatoryReviews', () => {
  it('should skip objectives with no risk flags', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'commanddeck-norisk-'));
    const oldStateDir = process.env.COMMANDDECK_STATE_DIR;
    try {
      process.env.COMMANDDECK_STATE_DIR = tempDir;

      delete require.cache[require.resolve('../lib/state')];
      delete require.cache[require.resolve('../lib/mission')];
      delete require.cache[require.resolve('../lib/worker')];
      delete require.cache[require.resolve('../lib/risk')];
      const stateModule = require('../lib/state');
      const { Mission } = require('../lib/mission');
      const worker = require('../lib/worker');

      const missionState = await stateModule.createMission('norisk-repo', {
        description: 'no risk test',
        slackChannel: null,
        slackThreadTs: null
      });

      await stateModule.withMissionLock('norisk-repo', missionState.mission_id, (s) => {
        s.status = 'in_progress';
        s.work_items = [
          {
            id: 'obj-1', title: 'simple change', status: 'done',
            depends_on: [], risk_flags: [] // No risk flags
          }
        ];
        return s;
      });

      // Track if executeSpecialist is called (it shouldn't be)
      const origExecute = worker.executeSpecialist;
      let executeCalled = false;
      worker.executeSpecialist = async () => { executeCalled = true; return { success: true }; };

      const mission = new Mission('norisk-repo', '', { reporter: { post: async () => {} } });
      mission.missionId = missionState.mission_id;
      mission.state = await stateModule.readMission('norisk-repo', missionState.mission_id);

      await mission.runMandatoryReviews();

      assert.equal(executeCalled, false, 'Should not review objective with no risk flags');

      worker.executeSpecialist = origExecute;
    } finally {
      process.env.COMMANDDECK_STATE_DIR = oldStateDir;
    }
  });

  it('should skip reviews already persisted in reviewed_by', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'commanddeck-review-'));
    const oldStateDir = process.env.COMMANDDECK_STATE_DIR;
    try {
      process.env.COMMANDDECK_STATE_DIR = tempDir;

      delete require.cache[require.resolve('../lib/state')];
      delete require.cache[require.resolve('../lib/mission')];
      delete require.cache[require.resolve('../lib/worker')];
      delete require.cache[require.resolve('../lib/risk')];
      const state = require('../lib/state');
      const { Mission } = require('../lib/mission');
      const risk = require('../lib/risk');
      const worker = require('../lib/worker');

      const missionState = await state.createMission('review-repo', {
        description: 'review test',
        slackChannel: null,
        slackThreadTs: null
      });

      await state.withMissionLock('review-repo', missionState.mission_id, (s) => {
        s.status = 'in_progress';
        s.work_items = [
          {
            id: 'obj-1', title: 'security change', status: 'done',
            depends_on: [], risk_flags: ['security'],
            reviewed_by: ['worf'] // Already reviewed by worf
          }
        ];
        return s;
      });

      // Stub risk to return worf as reviewer
      const origGetReviewers = risk.getMandatoryReviewers;
      risk.getMandatoryReviewers = () => ['worf'];

      // Track if executeSpecialist is called (it shouldn't be)
      const origExecute = worker.executeSpecialist;
      let executeCalled = false;
      worker.executeSpecialist = async () => { executeCalled = true; return { success: true }; };

      const mission = new Mission('review-repo', '', { reporter: { post: async () => {} } });
      mission.missionId = missionState.mission_id;
      mission.state = await state.readMission('review-repo', missionState.mission_id);

      await mission.runMandatoryReviews();

      assert.equal(executeCalled, false, 'Should not re-review already reviewed objective');

      // Restore
      risk.getMandatoryReviewers = origGetReviewers;
      worker.executeSpecialist = origExecute;
    } finally {
      process.env.COMMANDDECK_STATE_DIR = oldStateDir;
    }
  });
});
