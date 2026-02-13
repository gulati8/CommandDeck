'use strict';

const { execSync } = require('child_process');
const path = require('path');

const worktreeLib = require('./worktree');

const HEALTH_INTERVAL = parseInt(process.env.COMMANDDECK_HEALTH_INTERVAL || '120000', 10); // 2 min

// Track test failures per objective
const testFailureCounts = new Map();
// Track file edit counts per objective
const fileEditCounts = new Map();

// Run health checks on all active workers in a mission
async function patrol(mission, { reporter }) {
  const inProgress = mission.work_items.filter(w => w.status === 'in_progress');
  const alerts = [];

  for (const obj of inProgress) {
    if (obj.worker_index == null) continue;

    const wtPath = worktreeLib.worktreePath(mission.repo, obj.worker_index);
    const checks = runChecks(wtPath, obj);

    // Test failure loop
    if (checks.testFailures >= 2) {
      alerts.push({
        level: 'red',
        objective: obj.id,
        type: 'test_failure_loop',
        message: `${obj.assigned_to} has failed the same test twice on "${obj.title}"`
      });

      await reporter.post(
        `🔴 Stop-the-line: ${obj.assigned_to} has failed the same test twice ` +
        `on "${obj.title}." Pausing for guidance.\n\n` +
        `React 🔄 to retry, ⏭️ to skip, or reply with guidance.`
      );
      continue;
    }

    // Edit thrashing
    if (checks.thrashingFile) {
      alerts.push({
        level: 'red',
        objective: obj.id,
        type: 'edit_thrashing',
        message: `${obj.assigned_to} has edited ${checks.thrashingFile.name} ${checks.thrashingFile.count} times`
      });

      await reporter.post(
        `🔴 Stop-the-line: ${obj.assigned_to} has edited ${checks.thrashingFile.name} ` +
        `${checks.thrashingFile.count} times on "${obj.title}." Possible thrashing. ` +
        `Pausing for guidance.`
      );
      continue;
    }

    // Stuck worker (warning at 10 min, red alert at 20 min)
    if (checks.minutesSinceCommit > 20) {
      alerts.push({
        level: 'red',
        objective: obj.id,
        type: 'worker_timeout',
        message: `${obj.assigned_to} stuck for ${Math.round(checks.minutesSinceCommit)} minutes`
      });

      await reporter.post(
        `🔴 Red alert: ${obj.assigned_to} stuck on "${obj.title}" — ` +
        `no commits in ${Math.round(checks.minutesSinceCommit)} minutes. Restarting.`
      );
    } else if (checks.minutesSinceCommit > 10) {
      alerts.push({
        level: 'warning',
        objective: obj.id,
        type: 'slow_progress',
        message: `${obj.assigned_to} hasn't committed in ${Math.round(checks.minutesSinceCommit)} minutes`
      });

      await reporter.post(
        `👀 Guinan here. ${obj.assigned_to} hasn't committed in ` +
        `${Math.round(checks.minutesSinceCommit)} minutes on "${obj.title}". Monitoring.`
      );
    }
  }

  return {
    mission_id: mission.mission_id,
    workers: inProgress.map(obj => ({
      worker_index: obj.worker_index,
      objective: obj.id,
      assigned_to: obj.assigned_to,
      title: obj.title
    })),
    alerts,
    healthy: alerts.filter(a => a.level === 'red').length === 0
  };
}

// Run all health checks on a worktree
function runChecks(wtPath, objective) {
  return {
    minutesSinceCommit: getMinutesSinceLastCommit(wtPath),
    testFailures: getTestFailureCount(objective.id),
    thrashingFile: detectThrashing(wtPath, objective.id),
    editCount: getTotalEdits(wtPath)
  };
}

// Get minutes since last git commit in a worktree
function getMinutesSinceLastCommit(wtPath) {
  try {
    const timestamp = execSync('git log -1 --format=%ct', {
      cwd: wtPath,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim();

    const commitTime = parseInt(timestamp, 10) * 1000;
    return (Date.now() - commitTime) / 60000;
  } catch {
    return 999; // No commits — treat as very stale
  }
}

// Track test failures for an objective
function recordTestFailure(objectiveId, testName) {
  const key = `${objectiveId}:${testName}`;
  const count = (testFailureCounts.get(key) || 0) + 1;
  testFailureCounts.set(key, count);
  return count;
}

// Get the highest test failure count for an objective
function getTestFailureCount(objectiveId) {
  let max = 0;
  for (const [key, count] of testFailureCounts) {
    if (key.startsWith(`${objectiveId}:`)) {
      max = Math.max(max, count);
    }
  }
  return max;
}

// Detect edit thrashing: any file edited >10 times in recent git log
function detectThrashing(wtPath, objectiveId) {
  try {
    const output = execSync('git log --name-only --format="" -20', {
      cwd: wtPath,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    });

    const counts = {};
    for (const line of output.split('\n')) {
      const file = line.trim();
      if (!file) continue;
      counts[file] = (counts[file] || 0) + 1;
    }

    for (const [name, count] of Object.entries(counts)) {
      if (count > 10) {
        return { name, count };
      }
    }
  } catch {
    // Can't read git log — no thrashing detected
  }

  return null;
}

// Get total file edits in recent history
function getTotalEdits(wtPath) {
  try {
    const output = execSync('git log --name-only --format="" -20', {
      cwd: wtPath,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    });

    return output.split('\n').filter(l => l.trim()).length;
  } catch {
    return 0;
  }
}

// Reset tracking for a completed/restarted objective
function resetTracking(objectiveId) {
  for (const key of testFailureCounts.keys()) {
    if (key.startsWith(`${objectiveId}:`)) {
      testFailureCounts.delete(key);
    }
  }
  fileEditCounts.delete(objectiveId);
}

// Start the health patrol interval
function startPatrol(getMissions, reporter) {
  return setInterval(async () => {
    const missions = getMissions();
    for (const mission of missions) {
      if (mission.status === 'in_progress') {
        try {
          await patrol(mission, { reporter });
        } catch (err) {
          console.error(`Health patrol error for ${mission.mission_id}:`, err.message);
        }
      }
    }
  }, HEALTH_INTERVAL);
}

module.exports = {
  patrol,
  runChecks,
  recordTestFailure,
  resetTracking,
  startPatrol,
  HEALTH_INTERVAL
};
