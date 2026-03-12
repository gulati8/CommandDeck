'use strict';

const fs = require('fs');
const path = require('path');
const db = require('./db');

const STATE_DIR = process.env.COMMANDDECK_STATE_DIR || path.join(process.env.HOME, '.commanddeck');

// Get the mission state directory (still used for file artifacts: briefings, evidence, captains-log)
function missionDir(repo, missionId) {
  return path.join(STATE_DIR, 'projects', repo, 'missions', missionId);
}

function missionPath(repo, missionId) {
  return path.join(missionDir(repo, missionId), 'mission.json');
}

// Assemble a mission state object from DB (same shape as legacy mission.json)
function assembleMission(missionId) {
  const m = db.getMission(missionId);
  if (!m) return null;

  const objectives = db.getObjectives(missionId);
  const sessionLog = db.getSessionLog(missionId);

  return {
    mission_id: m.mission_id,
    repo: m.repo,
    default_branch: m.default_branch,
    description: m.description,
    status: m.status,
    created_at: m.created_at,
    updated_at: m.updated_at,
    slack_channel: m.slack_channel,
    slack_thread_ts: m.slack_thread_ts,
    integration_branch: m.integration_branch,
    pr: m.pr,
    plan_message_ts: m.plan_message_ts,
    is_follow_up: m.is_follow_up,
    parent_mission_id: m.parent_mission_id,
    work_items: objectives,
    session_log: sessionLog,
    config: m.config,
    safety: m.safety,
    version: 0 // no longer tracked, but kept for compat
  };
}

// Persist a full mission state object back to DB (reverse of assembleMission)
function persistMission(missionState) {
  const id = missionState.mission_id;

  db.updateMission(id, {
    status: missionState.status,
    default_branch: missionState.default_branch,
    integration_branch: missionState.integration_branch,
    slack_channel: missionState.slack_channel,
    slack_thread_ts: missionState.slack_thread_ts,
    pr_number: missionState.pr?.number || null,
    pr_url: missionState.pr?.url || null,
    pr_status: missionState.pr?.status || null,
    plan_message_ts: missionState.plan_message_ts || null,
    is_follow_up: missionState.is_follow_up ? 1 : 0,
    parent_mission_id: missionState.parent_mission_id || null,
    config: missionState.config || {},
    safety: missionState.safety || {}
  });

  // Sync work_items → objectives
  if (missionState.work_items) {
    db.setObjectives(id, missionState.work_items);
  }
}

// Atomic read-modify-write using SQLite transactions
async function withMissionLock(repo, missionId, mutatorFn) {
  const current = assembleMission(missionId);
  const updated = mutatorFn(current);
  if (updated !== undefined && updated !== null) {
    updated.version = (current?.version || 0) + 1;
    updated.updated_at = new Date().toISOString();
    persistMission(updated);
    return updated;
  }
  return current;
}

// Read mission state
async function readMission(repo, missionId) {
  return assembleMission(missionId);
}

// Lock-free read (same as readMission now since SQLite handles concurrency)
function readMissionUnsafe(repo, missionId) {
  return assembleMission(missionId);
}

// Write mission state
async function writeMission(repo, missionId, missionState) {
  missionState.version = (missionState.version || 0) + 1;
  missionState.updated_at = new Date().toISOString();
  persistMission(missionState);
}

// Update a single work item's status atomically
async function updateItemStatus(repo, missionId, objectiveId, status, extra = {}) {
  const obj = db.getObjective(missionId, objectiveId);
  if (!obj) throw new Error(`Objective ${objectiveId} not found in mission ${missionId}`);

  db.updateObjective(missionId, objectiveId, { status, ...extra });
  db.updateMission(missionId, {}); // touch updated_at
  return assembleMission(missionId);
}

// Get all work items in a given status (works on assembled state object)
function getItemsByStatus(missionState, status) {
  return (missionState.work_items || []).filter(w => w.status === status);
}

// Evaluate pending objectives and transition them to queued or upstream_failed.
// Returns the list of newly queued items ready for execution.
function evaluateReadiness(missionState) {
  const items = missionState.work_items || [];
  const statusById = new Map(items.map(w => [w.id, w.status]));
  const failedStatuses = new Set(['failed', 'upstream_failed']);

  for (const item of items) {
    if (item.status !== 'pending') continue;
    const deps = item.depends_on || [];
    if (deps.length === 0) {
      item.status = 'queued';
      statusById.set(item.id, 'queued');
    } else if (deps.some(dep => failedStatuses.has(statusById.get(dep)))) {
      item.status = 'upstream_failed';
      statusById.set(item.id, 'upstream_failed');
    } else if (deps.every(dep => statusById.get(dep) === 'done')) {
      item.status = 'queued';
      statusById.set(item.id, 'queued');
    }
  }

  return items.filter(w => w.status === 'queued');
}

// Legacy alias
function getReadyItems(missionState) {
  return evaluateReadiness(missionState);
}

// Increment session count
async function incrementSessionCount(repo, missionId) {
  const m = db.getMission(missionId);
  if (!m) throw new Error(`Mission ${missionId} not found`);
  const safety = m.safety || {};
  safety.session_count = (safety.session_count || 0) + 1;
  db.updateMission(missionId, { safety });
  return assembleMission(missionId);
}

// Add a session log entry
async function addSessionLog(repo, missionId, entry) {
  db.addSessionLog(missionId, entry);
  return assembleMission(missionId);
}

// Load project config — still file-based (per-project config.json)
function loadProjectConfig(repo) {
  const configPath = path.join(STATE_DIR, 'projects', repo, 'config.json');
  const defaults = {
    default_branch: 'main',
    max_workers: parseInt(process.env.COMMANDDECK_MAX_WORKERS || '1', 10),
    max_sessions: parseInt(process.env.COMMANDDECK_MAX_SESSIONS || '50', 10),
    max_elapsed_hours: parseInt(process.env.COMMANDDECK_MAX_HOURS || '6', 10),
    test_command: null,
    lint_command: null,
    build_command: null,
    model_overrides: {},
    db_image: null,
    db_setup_commands: []
  };

  try {
    const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    return { ...defaults, ...raw };
  } catch {
    return defaults;
  }
}

// Initialize a new mission
async function createMission(repo, { description, slackChannel, slackThreadTs }) {
  const config = loadProjectConfig(repo);
  const missionId = `mission-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(Date.now()).slice(-3)}`;
  const integrationBranch = `commanddeck/${missionId}/integration`;

  const safety = {
    max_sessions: config.max_sessions,
    max_elapsed_hours: config.max_elapsed_hours,
    max_parallel_workers: config.max_workers,
    max_concurrent_missions: 1,
    session_count: 0,
    started_at: new Date().toISOString()
  };

  const missionConfig = {
    test_command: config.test_command,
    lint_command: config.lint_command,
    build_command: config.build_command,
    model_overrides: config.model_overrides
  };

  db.createMission(missionId, {
    repo,
    description,
    defaultBranch: config.default_branch,
    integrationBranch,
    slackChannel,
    slackThreadTs,
    config: missionConfig,
    safety
  });

  // Create mission directory structure (still needed for file artifacts)
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

  return assembleMission(missionId);
}

// Get mission status summary
async function getMissionStatus(missionId, context) {
  if (!missionId) {
    const m = db.getLatestMission();
    if (!m) return null;
    return addProgress(assembleMission(m.mission_id));
  }

  const result = assembleMission(missionId);
  if (!result) return null;
  return addProgress(result);
}

function addProgress(missionState) {
  const items = missionState.work_items || [];
  const done = items.filter(w => w.status === 'done').length;
  const total = items.length;
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

// Load installation-level global config
function loadGlobalConfig() {
  const configPath = path.join(STATE_DIR, 'config.json');
  const defaults = {
    github_org: 'gulati8',
    domain: 'gulatilabs.me',
    registry: 'ghcr.io/gulati8',
    caddyfile_path: '/srv/proxy/Caddyfile',
    caddy_container: 'proxy-caddy-1',
    deploy_dir: '/srv'
  };
  try {
    const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    return { ...defaults, ...raw };
  } catch {
    return defaults;
  }
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
  readMissionUnsafe,
  writeMission,
  updateItemStatus,
  getItemsByStatus,
  evaluateReadiness,
  getReadyItems,
  incrementSessionCount,
  addSessionLog,
  loadProjectConfig,
  loadGlobalConfig,
  createMission,
  getMissionStatus,
  formatStardate,
  appendCaptainsLog
};
