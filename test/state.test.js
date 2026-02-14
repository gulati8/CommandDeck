'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

function freshStateModule(tempDir) {
  process.env.COMMANDDECK_STATE_DIR = tempDir;
  delete require.cache[require.resolve('../lib/state')];
  return require('../lib/state');
}

test('createMission uses project config default_branch and max_workers', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'commanddeck-state-'));
  const repo = 'repo-a';
  const projectDir = path.join(tempDir, 'projects', repo);
  fs.mkdirSync(projectDir, { recursive: true });
  fs.writeFileSync(
    path.join(projectDir, 'config.json'),
    JSON.stringify({ default_branch: 'trunk', max_workers: 7 }),
    'utf-8'
  );

  const state = freshStateModule(tempDir);
  const mission = await state.createMission(repo, { description: 'test mission' });
  assert.equal(mission.default_branch, 'trunk');
  assert.equal(mission.safety.max_parallel_workers, 7);
  assert.ok(mission.version >= 1);
});

test('updateMission increments version atomically', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'commanddeck-state-'));
  const state = freshStateModule(tempDir);
  const mission = await state.createMission('repo-b', { description: 'atomic test' });

  const updated = await state.updateMission('repo-b', mission.mission_id, (draft) => {
    draft.status = 'in_progress';
    draft.safety.session_count += 1;
  });

  assert.equal(updated.status, 'in_progress');
  assert.equal(updated.safety.session_count, 1);
  assert.ok(updated.version > mission.version);
});

test('getMissionStatus without mission id returns latest active mission', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'commanddeck-state-'));
  const state = freshStateModule(tempDir);

  const first = await state.createMission('repo-c', { description: 'older mission' });
  await new Promise((r) => setTimeout(r, 5));
  const second = await state.createMission('repo-d', { description: 'newest mission' });

  await state.writeMission('repo-c', first.mission_id, { ...first, status: 'review' });
  await state.writeMission('repo-d', second.mission_id, { ...second, status: 'in_progress' });

  const latest = await state.getMissionStatus();
  assert.equal(latest.repo, 'repo-d');
});
