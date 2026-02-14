'use strict';

const fs = require('fs');
const path = require('path');

const STATE_DIR = process.env.COMMANDDECK_STATE_DIR || path.join(process.env.HOME, '.commanddeck');

// Simple file-based locking: write a .lock file, remove on release.
// Uses mkdir for atomic lock acquisition (fails if dir already exists).
const LOCK_TIMEOUT = 10000; // 10s
const LOCK_RETRY_INTERVAL = 50; // 50ms

function lockPath(filePath) {
  return filePath + '.lock';
}

async function acquireLock(filePath) {
  const lock = lockPath(filePath);
  const start = Date.now();

  while (Date.now() - start < LOCK_TIMEOUT) {
    try {
      fs.mkdirSync(lock);
      return;
    } catch (err) {
      if (err.code === 'EEXIST') {
        // Check for stale lock (older than LOCK_TIMEOUT)
        try {
          const stat = fs.statSync(lock);
          if (Date.now() - stat.mtimeMs > LOCK_TIMEOUT) {
            fs.rmdirSync(lock);
            continue;
          }
        } catch {
          // Lock was removed between check and stat — retry
          continue;
        }
        await new Promise(r => setTimeout(r, LOCK_RETRY_INTERVAL));
        continue;
      }
      throw err;
    }
  }
  throw new Error(`Failed to acquire lock on ${filePath} after ${LOCK_TIMEOUT}ms`);
}

function releaseLock(filePath) {
  try {
    fs.rmdirSync(lockPath(filePath));
  } catch {
    // Lock already released
  }
}

// Ensure directory exists for a file path
function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
}

// Get the mission state directory for a given repo and mission ID
function missionDir(repo, missionId) {
  return path.join(STATE_DIR, 'projects', repo, 'missions', missionId);
}

// Get the path to mission.json
function missionPath(repo, missionId) {
  return path.join(missionDir(repo, missionId), 'mission.json');
}

// Atomic read-modify-write: acquires lock once, reads, applies mutator, writes.
// This prevents the race condition in separate read() then write() calls.
async function withMissionLock(repo, missionId, mutatorFn) {
  const filePath = missionPath(repo, missionId);
  ensureDir(filePath);

  await acquireLock(filePath);
  try {
    let current = null;
    if (fs.existsSync(filePath)) {
      current = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }

    const updated = mutatorFn(current);
    if (updated !== undefined && updated !== null) {
      updated.version = (current?.version || 0) + 1;
      updated.updated_at = new Date().toISOString();
      const tmpPath = filePath + '.tmp';
      fs.writeFileSync(tmpPath, JSON.stringify(updated, null, 2) + '\n', 'utf-8');
      fs.renameSync(tmpPath, filePath);
      return updated;
    }
    return current;
  } finally {
    releaseLock(filePath);
  }
}

// Read mission.json with file locking
async function readMission(repo, missionId) {
  const filePath = missionPath(repo, missionId);
  if (!fs.existsSync(filePath)) return null;

  await acquireLock(filePath);
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } finally {
    releaseLock(filePath);
  }
}

// Write mission.json atomically with file locking
async function writeMission(repo, missionId, missionState) {
  const filePath = missionPath(repo, missionId);
  ensureDir(filePath);

  await acquireLock(filePath);
  try {
    missionState.version = (missionState.version || 0) + 1;
    missionState.updated_at = new Date().toISOString();
    const tmpPath = filePath + '.tmp';
    fs.writeFileSync(tmpPath, JSON.stringify(missionState, null, 2) + '\n', 'utf-8');
    fs.renameSync(tmpPath, filePath);
  } finally {
    releaseLock(filePath);
  }
}

// Update a single work item's status atomically
async function updateItemStatus(repo, missionId, objectiveId, status, extra = {}) {
  return withMissionLock(repo, missionId, (state) => {
    if (!state) throw new Error(`Mission ${missionId} not found for repo ${repo}`);
    const item = state.work_items.find(w => w.id === objectiveId);
    if (!item) throw new Error(`Objective ${objectiveId} not found in mission ${missionId}`);
    item.status = status;
    Object.assign(item, extra);
    return state;
  });
}

// Get all work items in a given status
function getItemsByStatus(state, status) {
  return state.work_items.filter(w => w.status === status);
}

// Get work items that are ready to execute: status="ready" and all depends_on are "done"
function getReadyItems(state) {
  const doneIds = new Set(
    state.work_items.filter(w => w.status === 'done').map(w => w.id)
  );

  return state.work_items.filter(w =>
    w.status === 'ready' &&
    w.depends_on.every(dep => doneIds.has(dep))
  );
}

// Increment session count atomically
async function incrementSessionCount(repo, missionId) {
  return withMissionLock(repo, missionId, (state) => {
    if (!state) throw new Error(`Mission ${missionId} not found`);
    state.safety.session_count += 1;
    return state;
  });
}

// Add a session log entry atomically
async function addSessionLog(repo, missionId, entry) {
  return withMissionLock(repo, missionId, (state) => {
    if (!state) throw new Error(`Mission ${missionId} not found`);
    state.session_log.push(entry);
    return state;
  });
}

// Load project config, falling back to defaults
function loadProjectConfig(repo) {
  const configPath = path.join(STATE_DIR, 'projects', repo, 'config.json');
  const defaults = {
    default_branch: 'main',
    max_workers: parseInt(process.env.COMMANDDECK_MAX_WORKERS || '3', 10),
    max_sessions: parseInt(process.env.COMMANDDECK_MAX_SESSIONS || '50', 10),
    max_elapsed_hours: parseInt(process.env.COMMANDDECK_MAX_HOURS || '6', 10),
    test_command: null,
    lint_command: null,
    build_command: null,
    model_overrides: {}
  };

  try {
    const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    return { ...defaults, ...raw };
  } catch {
    return defaults;
  }
}

// Initialize a new mission, reading project config for defaults
async function createMission(repo, { description, slackChannel, slackThreadTs }) {
  const config = loadProjectConfig(repo);
  const missionId = `mission-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(Date.now()).slice(-3)}`;

  const missionState = {
    mission_id: missionId,
    repo,
    default_branch: config.default_branch,
    description,
    status: 'planning',
    created_at: new Date().toISOString(),
    slack_channel: slackChannel || null,
    slack_thread_ts: slackThreadTs || null,
    integration_branch: `commanddeck/${missionId}/integration`,
    pr: { number: null, url: null, status: null },
    work_items: [],
    session_log: [],
    config: {
      test_command: config.test_command,
      lint_command: config.lint_command,
      build_command: config.build_command,
      model_overrides: config.model_overrides
    },
    safety: {
      max_sessions: config.max_sessions,
      max_elapsed_hours: config.max_elapsed_hours,
      max_parallel_workers: config.max_workers,
      max_concurrent_missions: 1,
      session_count: 0,
      started_at: new Date().toISOString()
    },
    version: 0
  };

  // Create mission directory structure
  const dir = missionDir(repo, missionId);
  fs.mkdirSync(path.join(dir, 'briefings'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'artifacts'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'backups'), { recursive: true });

  // Write initial captain's log
  const stardate = formatStardate(new Date());
  fs.writeFileSync(
    path.join(dir, 'captains-log.md'),
    `# Captain's Log — ${description}\n\n## Stardate ${stardate}\nMission initiated: "${description}"\nRepo: ${repo}\n\n`,
    'utf-8'
  );

  await writeMission(repo, missionId, missionState);
  return missionState;
}

// Get mission status summary — supports finding latest mission when no ID given
async function getMissionStatus(missionId, context) {
  const projectsDir = path.join(STATE_DIR, 'projects');
  if (!fs.existsSync(projectsDir)) return null;

  // If no missionId, find the most recent mission across all projects
  if (!missionId) {
    let latest = null;
    let latestTime = 0;

    for (const repo of fs.readdirSync(projectsDir)) {
      const missionsDir = path.join(projectsDir, repo, 'missions');
      if (!fs.existsSync(missionsDir)) continue;

      for (const mid of fs.readdirSync(missionsDir)) {
        const s = await readMission(repo, mid);
        if (s) {
          const t = new Date(s.created_at).getTime();
          if (t > latestTime) {
            latestTime = t;
            latest = s;
          }
        }
      }
    }

    if (!latest) return null;
    return addProgress(latest);
  }

  // Search across all projects for the specific mission
  for (const repo of fs.readdirSync(projectsDir)) {
    const s = await readMission(repo, missionId);
    if (s) return addProgress(s);
  }

  return null;
}

function addProgress(missionState) {
  const done = missionState.work_items.filter(w => w.status === 'done').length;
  const total = missionState.work_items.length;
  return {
    ...missionState,
    progress: { done, total, percent: total > 0 ? Math.round((done / total) * 100) : 0 }
  };
}

// Format a Date as a stardate: YYYY.DDD.HHMM
function formatStardate(date) {
  const year = date.getFullYear();
  const start = new Date(year, 0, 0);
  const diff = date - start;
  const oneDay = 86400000;
  const dayOfYear = Math.floor(diff / oneDay);
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  return `${year}.${String(dayOfYear).padStart(3, '0')}.${hours}${minutes}`;
}

// Append to captain's log
async function appendCaptainsLog(repo, missionId, text) {
  const dir = missionDir(repo, missionId);
  const logPath = path.join(dir, 'captains-log.md');
  const stardate = formatStardate(new Date());
  const entry = `\n## Stardate ${stardate}\n${text}\n`;
  fs.appendFileSync(logPath, entry, 'utf-8');
}

module.exports = {
  STATE_DIR,
  missionDir,
  missionPath,
  withMissionLock,
  readMission,
  writeMission,
  updateItemStatus,
  getItemsByStatus,
  getReadyItems,
  incrementSessionCount,
  addSessionLog,
  loadProjectConfig,
  createMission,
  getMissionStatus,
  formatStardate,
  appendCaptainsLog
};
