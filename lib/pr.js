'use strict';

const { execFileSync } = require('child_process');

const { buildPRBody } = require('./evidence');
const { writeMission } = require('./state');
const worktree = require('./worktree');

// Push the integration branch and create a PR
async function create(mission, { reporter } = {}) {
  const projectDir = worktree.projectPath(mission.repo);
  const integrationBranch = mission.integration_branch;
  assertSafeRef(integrationBranch, 'integration branch');
  assertSafeRef(mission.default_branch, 'default branch');
  const prBody = buildPRBody(mission);

  // Push the integration branch
  runGit(projectDir, ['push', 'origin', integrationBranch]);

  // Create the PR via gh CLI
  const prUrl = execFileSync(
    'gh',
    [
      'pr',
      'create',
      '--title',
      `🖖 CommandDeck: ${mission.description}`,
      '--body-file',
      '/dev/stdin',
      '--base',
      mission.default_branch,
      '--head',
      integrationBranch
    ],
    {
      cwd: projectDir,
      input: prBody,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    }
  ).trim();

  // Update mission state with PR info
  const prNumber = extractPRNumber(prUrl);
  mission.pr = { number: prNumber, url: prUrl, status: 'open' };
  mission.status = 'review';
  await writeMission(mission.repo, mission.mission_id, mission);

  if (reporter) {
    await reporter.post(
      `🖖 Mission complete! PR ready for review:\n${prUrl}\n\n` +
      `${mission.work_items.length} objectives completed. ` +
      `Check the PR description for evidence bundles and risk flags.`
    );
  }

  return { url: prUrl, number: prNumber };
}

// Update the PR body (e.g., after additional objectives complete)
async function updateBody(mission) {
  if (!mission.pr?.number) return;

  const projectDir = worktree.projectPath(mission.repo);
  const prBody = buildPRBody(mission);

  execFileSync(
    'gh',
    ['pr', 'edit', String(mission.pr.number), '--body-file', '/dev/stdin'],
    {
      cwd: projectDir,
      input: prBody,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    }
  );
}

// Check PR status (open, closed, merged)
function checkStatus(mission) {
  if (!mission.pr?.number) return null;

  const projectDir = worktree.projectPath(mission.repo);

  try {
    const output = execFileSync(
      'gh',
      ['pr', 'view', String(mission.pr.number), '--json', 'state,mergedAt,closedAt'],
      {
        cwd: projectDir,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe']
      }
    );

    const data = JSON.parse(output);
    if (data.mergedAt) return 'merged';
    if (data.closedAt) return 'closed';
    return data.state?.toLowerCase() || 'open';
  } catch {
    return 'unknown';
  }
}

// Clean up branches after PR is merged
async function cleanup(mission, { reporter } = {}) {
  const projectDir = worktree.projectPath(mission.repo);

  // Remove all worktrees first
  worktree.removeAll(mission.repo);

  // Delete objective branches
  for (const item of mission.work_items) {
    if (item.git_branch) {
      try {
        runGit(projectDir, ['branch', '-D', item.git_branch]);
      } catch { /* branch doesn't exist locally */ }

      try {
        runGit(projectDir, ['push', 'origin', '--delete', item.git_branch]);
      } catch { /* branch doesn't exist on remote */ }
    }
  }

  // Delete integration branch
  try {
    runGit(projectDir, ['branch', '-D', mission.integration_branch]);
  } catch { /* doesn't exist locally */ }

  try {
    runGit(projectDir, ['push', 'origin', '--delete', mission.integration_branch]);
  } catch { /* doesn't exist on remote */ }

  // Update mission state
  mission.status = 'completed';
  await writeMission(mission.repo, mission.mission_id, mission);

  if (reporter) {
    await reporter.post('✅ PR merged. Branches cleaned up.');
  }
}

// Extract PR number from URL
function extractPRNumber(url) {
  const match = url.match(/\/pull\/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

function runGit(projectDir, args) {
  return execFileSync('git', args, {
    cwd: projectDir,
    stdio: ['pipe', 'pipe', 'pipe'],
    encoding: 'utf-8'
  });
}

function assertSafeRef(value, fieldName) {
  if (!/^[A-Za-z0-9._/-]+$/.test(value)) {
    throw new Error(`Unsafe ${fieldName}: ${value}`);
  }
}

module.exports = {
  create,
  updateBody,
  checkStatus,
  cleanup
};
