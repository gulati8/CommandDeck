'use strict';

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

let _db = null;
let _dbPath = null;

// --- Schema ---

const SCHEMA = `
CREATE TABLE IF NOT EXISTS missions (
  id            TEXT PRIMARY KEY,
  repo          TEXT NOT NULL,
  description   TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'planning',
  default_branch TEXT DEFAULT 'main',
  integration_branch TEXT,
  slack_channel  TEXT,
  slack_thread_ts TEXT,
  pr_number     INTEGER,
  pr_url        TEXT,
  pr_status     TEXT,
  plan_message_ts TEXT,
  is_follow_up  INTEGER DEFAULT 0,
  parent_mission_id TEXT,
  config        TEXT DEFAULT '{}',
  safety        TEXT DEFAULT '{}',
  created_at    TEXT DEFAULT (datetime('now')),
  updated_at    TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS objectives (
  id            TEXT NOT NULL,
  mission_id    TEXT NOT NULL,
  title         TEXT DEFAULT '',
  description   TEXT,
  status        TEXT DEFAULT 'ready',
  phase         INTEGER DEFAULT 1,
  parallel_group TEXT,
  assigned_to   TEXT,
  git_branch    TEXT,
  worker_index  INTEGER,
  risk_flags    TEXT DEFAULT '[]',
  depends_on    TEXT DEFAULT '[]',
  context_sources TEXT DEFAULT '[]',
  evidence_path TEXT,
  reviewed_by   TEXT DEFAULT '[]',
  merged        INTEGER DEFAULT 0,
  started_at    TEXT,
  completed_at  TEXT,
  error         TEXT,
  PRIMARY KEY (mission_id, id),
  FOREIGN KEY (mission_id) REFERENCES missions(id)
);

CREATE TABLE IF NOT EXISTS threads (
  channel       TEXT NOT NULL,
  thread_ts     TEXT NOT NULL,
  repo          TEXT,
  mission_id    TEXT,
  integration_branch TEXT,
  pr_number     INTEGER,
  pr_url        TEXT,
  original_description TEXT,
  status        TEXT DEFAULT 'idle',
  follow_up_count INTEGER DEFAULT 0,
  tracked_at    TEXT DEFAULT (datetime('now')),
  updated_at    TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (channel, thread_ts)
);

CREATE TABLE IF NOT EXISTS approvals (
  message_ts    TEXT PRIMARY KEY,
  type          TEXT NOT NULL,
  repo          TEXT NOT NULL,
  mission_id    TEXT,
  pr_number     INTEGER,
  pr_url        TEXT,
  channel       TEXT,
  thread_ts     TEXT,
  tracked_at    TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS channel_map (
  channel_id    TEXT PRIMARY KEY,
  repo          TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS proposals (
  message_ts    TEXT PRIMARY KEY,
  proposed_path TEXT,
  target_dir    TEXT,
  file_name     TEXT,
  proposed_at   TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS session_log (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  mission_id    TEXT,
  session_id    TEXT,
  agent         TEXT,
  objective     TEXT,
  exit_code     INTEGER,
  started_at    TEXT,
  ended_at      TEXT
);

CREATE INDEX IF NOT EXISTS idx_objectives_mission ON objectives(mission_id);
CREATE INDEX IF NOT EXISTS idx_objectives_status ON objectives(status);
CREATE INDEX IF NOT EXISTS idx_missions_status ON missions(status);
CREATE INDEX IF NOT EXISTS idx_missions_repo ON missions(repo);
`;

// --- Init ---

function getStateDir() {
  return process.env.COMMANDDECK_STATE_DIR || path.join(process.env.HOME, '.commanddeck');
}

function getDb() {
  const stateDir = getStateDir();
  const dbPath = path.join(stateDir, 'app.db');

  // If state dir changed (e.g. tests), reset the connection
  if (_db && _dbPath !== dbPath) {
    _db.close();
    _db = null;
    _dbPath = null;
  }

  if (_db) return _db;
  fs.mkdirSync(stateDir, { recursive: true });

  // Migrate: rename state.db → app.db if old file exists
  const legacyPath = path.join(stateDir, 'state.db');
  if (!fs.existsSync(dbPath) && fs.existsSync(legacyPath)) {
    fs.renameSync(legacyPath, dbPath);
    // Also move WAL/SHM files if present
    for (const suffix of ['-wal', '-shm']) {
      const old = legacyPath + suffix;
      if (fs.existsSync(old)) fs.renameSync(old, dbPath + suffix);
    }
  }

  _db = new Database(dbPath);
  _dbPath = dbPath;
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  _db.exec(SCHEMA);
  return _db;
}

function close() {
  if (_db) {
    _db.close();
    _db = null;
  }
}

// For testing: reset with a fresh in-memory or temp db
function _resetForTest(stateDir) {
  close();
  fs.mkdirSync(stateDir, { recursive: true });
  const dbPath = path.join(stateDir, 'app.db');
  _db = new Database(dbPath);
  _dbPath = dbPath;
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  _db.exec(SCHEMA);
  return _db;
}

// --- Helpers ---

function jsonParse(val, fallback) {
  if (!val) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}

// --- Missions ---

function createMission(id, { repo, description, defaultBranch, integrationBranch, slackChannel, slackThreadTs, config, safety, isFollowUp, parentMissionId }) {
  const db = getDb();
  db.prepare(`
    INSERT INTO missions (id, repo, description, status, default_branch, integration_branch, slack_channel, slack_thread_ts, config, safety, is_follow_up, parent_mission_id)
    VALUES (?, ?, ?, 'planning', ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, repo, description, defaultBranch || 'main', integrationBranch || null,
    slackChannel || null, slackThreadTs || null,
    JSON.stringify(config || {}), JSON.stringify(safety || {}),
    isFollowUp ? 1 : 0, parentMissionId || null
  );
  return getMission(id);
}

function getMission(id) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM missions WHERE id = ?').get(id);
  if (!row) return null;
  return deserializeMission(row);
}

function updateMission(id, fields) {
  const db = getDb();
  const sets = [];
  const vals = [];
  for (const [key, value] of Object.entries(fields)) {
    if (key === 'config' || key === 'safety') {
      sets.push(`${key} = ?`);
      vals.push(JSON.stringify(value));
    } else {
      sets.push(`${key} = ?`);
      vals.push(value);
    }
  }
  sets.push("updated_at = datetime('now')");
  vals.push(id);
  db.prepare(`UPDATE missions SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  return getMission(id);
}

function listMissionsByRepo(repo) {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM missions WHERE repo = ? ORDER BY created_at DESC').all(repo);
  return rows.map(deserializeMission);
}

function listMissionsByStatus(statuses) {
  const db = getDb();
  const placeholders = statuses.map(() => '?').join(', ');
  const rows = db.prepare(`SELECT * FROM missions WHERE status IN (${placeholders}) ORDER BY created_at DESC`).all(...statuses);
  return rows.map(deserializeMission);
}

function getLatestMission() {
  const db = getDb();
  const row = db.prepare('SELECT * FROM missions ORDER BY created_at DESC, rowid DESC LIMIT 1').get();
  if (!row) return null;
  return deserializeMission(row);
}

function findMission(missionId) {
  return getMission(missionId);
}

function listAllRepos() {
  const db = getDb();
  const missionRepos = db.prepare('SELECT DISTINCT repo FROM missions').all().map(r => r.repo);
  const channelRepos = db.prepare('SELECT DISTINCT repo FROM channel_map').all().map(r => r.repo);
  return [...new Set([...missionRepos, ...channelRepos])].sort();
}

function missionOverview() {
  const db = getDb();
  const total = db.prepare('SELECT COUNT(*) as count FROM missions').get().count;
  const activeStatuses = ['planning', 'in_progress', 'pending_approval', 'review'];
  const placeholders = activeStatuses.map(() => '?').join(', ');
  const active = db.prepare(`SELECT COUNT(*) as count FROM missions WHERE status IN (${placeholders})`).get(...activeStatuses).count;
  const workers = db.prepare("SELECT COUNT(*) as count FROM objectives WHERE status = 'in_progress'").get().count;
  return { total, active, workers };
}

function deserializeMission(row) {
  return {
    mission_id: row.id,
    repo: row.repo,
    description: row.description,
    status: row.status,
    default_branch: row.default_branch,
    integration_branch: row.integration_branch,
    slack_channel: row.slack_channel,
    slack_thread_ts: row.slack_thread_ts,
    pr: {
      number: row.pr_number,
      url: row.pr_url,
      status: row.pr_status
    },
    plan_message_ts: row.plan_message_ts,
    is_follow_up: !!row.is_follow_up,
    parent_mission_id: row.parent_mission_id,
    config: jsonParse(row.config, {}),
    safety: jsonParse(row.safety, {}),
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

// --- Objectives ---

function setObjectives(missionId, objectives) {
  const db = getDb();
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM objectives WHERE mission_id = ?').run(missionId);
    const insert = db.prepare(`
      INSERT INTO objectives (id, mission_id, title, description, status, phase, parallel_group, assigned_to, git_branch, worker_index, risk_flags, depends_on, context_sources, evidence_path, reviewed_by, merged, started_at, completed_at, error)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const obj of objectives) {
      insert.run(
        obj.id, missionId, obj.title || '', obj.description || null,
        obj.status || 'ready', obj.phase || 1, obj.parallel_group || null,
        obj.assigned_to || null, obj.git_branch || null, obj.worker_index ?? null,
        JSON.stringify(obj.risk_flags || []),
        JSON.stringify(obj.depends_on || []),
        JSON.stringify(obj.context_sources || []),
        obj.evidence_path || null,
        JSON.stringify(obj.reviewed_by || []),
        obj.merged ? 1 : 0,
        obj.started_at || null, obj.completed_at || null, obj.error || null
      );
    }
    db.prepare("UPDATE missions SET updated_at = datetime('now') WHERE id = ?").run(missionId);
  });
  tx();
}

function getObjectives(missionId) {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM objectives WHERE mission_id = ? ORDER BY phase, id').all(missionId);
  return rows.map(deserializeObjective);
}

function getObjective(missionId, objectiveId) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM objectives WHERE mission_id = ? AND id = ?').get(missionId, objectiveId);
  if (!row) return null;
  return deserializeObjective(row);
}

function updateObjective(missionId, objectiveId, fields) {
  const db = getDb();
  const sets = [];
  const vals = [];
  for (const [key, value] of Object.entries(fields)) {
    if (key === 'risk_flags' || key === 'depends_on' || key === 'context_sources' || key === 'reviewed_by') {
      sets.push(`${key} = ?`);
      vals.push(JSON.stringify(value));
    } else if (key === 'merged') {
      sets.push(`${key} = ?`);
      vals.push(value ? 1 : 0);
    } else {
      sets.push(`${key} = ?`);
      vals.push(value);
    }
  }
  vals.push(missionId, objectiveId);
  db.prepare(`UPDATE objectives SET ${sets.join(', ')} WHERE mission_id = ? AND id = ?`).run(...vals);
  db.prepare("UPDATE missions SET updated_at = datetime('now') WHERE id = ?").run(missionId);
}

function getReadyObjectives(missionId) {
  const db = getDb();
  const all = getObjectives(missionId);
  const doneIds = new Set(all.filter(o => o.status === 'done').map(o => o.id));
  return all.filter(o =>
    o.status === 'ready' &&
    o.depends_on.every(dep => doneIds.has(dep))
  );
}

function getObjectivesByStatus(missionId, status) {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM objectives WHERE mission_id = ? AND status = ?').all(missionId, status);
  return rows.map(deserializeObjective);
}

function deserializeObjective(row) {
  return {
    id: row.id,
    mission_id: row.mission_id,
    title: row.title,
    description: row.description,
    status: row.status,
    phase: row.phase,
    parallel_group: row.parallel_group,
    assigned_to: row.assigned_to,
    git_branch: row.git_branch,
    worker_index: row.worker_index,
    risk_flags: jsonParse(row.risk_flags, []),
    depends_on: jsonParse(row.depends_on, []),
    context_sources: jsonParse(row.context_sources, []),
    evidence_path: row.evidence_path,
    reviewed_by: jsonParse(row.reviewed_by, []),
    merged: !!row.merged,
    started_at: row.started_at,
    completed_at: row.completed_at,
    error: row.error
  };
}

// --- Threads ---

function trackThread(channel, threadTs, data) {
  const db = getDb();
  db.prepare(`
    INSERT OR REPLACE INTO threads (channel, thread_ts, repo, mission_id, integration_branch, pr_number, pr_url, original_description, status, follow_up_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    channel, threadTs, data.repo, data.mission_id || null,
    data.integration_branch || null, data.pr_number || null, data.pr_url || null,
    data.original_description || null, data.status || 'idle',
    data.follow_up_count || 0
  );
}

function getThread(channel, threadTs) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM threads WHERE channel = ? AND thread_ts = ?').get(channel, threadTs);
  if (!row) return null;
  return {
    channel: row.channel,
    thread_ts: row.thread_ts,
    repo: row.repo,
    mission_id: row.mission_id,
    integration_branch: row.integration_branch,
    pr_number: row.pr_number,
    pr_url: row.pr_url,
    original_description: row.original_description,
    status: row.status,
    follow_up_count: row.follow_up_count,
    tracked_at: row.tracked_at,
    updated_at: row.updated_at
  };
}

function updateThreadStatus(channel, threadTs, status) {
  const db = getDb();
  db.prepare("UPDATE threads SET status = ?, updated_at = datetime('now') WHERE channel = ? AND thread_ts = ?")
    .run(status, channel, threadTs);
}

function incrementFollowUp(channel, threadTs) {
  const db = getDb();
  db.prepare("UPDATE threads SET follow_up_count = follow_up_count + 1, updated_at = datetime('now') WHERE channel = ? AND thread_ts = ?")
    .run(channel, threadTs);
}

function removeThread(channel, threadTs) {
  const db = getDb();
  db.prepare('DELETE FROM threads WHERE channel = ? AND thread_ts = ?').run(channel, threadTs);
}

function resetStaleThreads() {
  const db = getDb();
  // Assessing threads with a mission reset to idle; without a mission reset to conversing
  db.prepare("UPDATE threads SET status = 'idle', updated_at = datetime('now') WHERE status = 'assessing' AND mission_id IS NOT NULL").run();
  db.prepare("UPDATE threads SET status = 'conversing', updated_at = datetime('now') WHERE status = 'assessing' AND mission_id IS NULL").run();
  db.prepare("UPDATE threads SET status = 'conversing', updated_at = datetime('now') WHERE status = 'launching'").run();
  db.prepare("UPDATE threads SET status = 'conversing', updated_at = datetime('now') WHERE status = 'onboarding'").run();
  db.prepare("UPDATE threads SET status = 'conversing', updated_at = datetime('now') WHERE status = 'creating'").run();
}

function listActiveThreads() {
  const db = getDb();
  return db.prepare("SELECT * FROM threads WHERE status != 'idle'").all();
}

// --- Approvals (PR + Plan) ---

function trackApproval(messageTs, type, data) {
  const db = getDb();
  db.prepare(`
    INSERT OR REPLACE INTO approvals (message_ts, type, repo, mission_id, pr_number, pr_url, channel, thread_ts)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    messageTs, type, data.repo, data.mission_id || null,
    data.pr_number || null, data.pr_url || null,
    data.channel || null, data.thread_ts || null
  );
}

function getApproval(messageTs) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM approvals WHERE message_ts = ?').get(messageTs);
  if (!row) return null;
  return {
    message_ts: row.message_ts,
    type: row.type,
    repo: row.repo,
    mission_id: row.mission_id,
    pr_number: row.pr_number,
    pr_url: row.pr_url,
    channel: row.channel,
    thread_ts: row.thread_ts,
    tracked_at: row.tracked_at
  };
}

function removeApproval(messageTs) {
  const db = getDb();
  db.prepare('DELETE FROM approvals WHERE message_ts = ?').run(messageTs);
}

function listApprovalsByType(type) {
  const db = getDb();
  return db.prepare('SELECT * FROM approvals WHERE type = ?').all(type);
}

// --- Channel Map ---

function setChannelMapping(channelId, repo) {
  const db = getDb();
  db.prepare('INSERT OR REPLACE INTO channel_map (channel_id, repo) VALUES (?, ?)').run(channelId, repo);
}

function getRepoForChannel(channelId) {
  const db = getDb();
  const row = db.prepare('SELECT repo FROM channel_map WHERE channel_id = ?').get(channelId);
  return row ? row.repo : null;
}

function getChannelForRepo(repo) {
  const db = getDb();
  const row = db.prepare('SELECT channel_id FROM channel_map WHERE repo = ?').get(repo);
  return row ? row.channel_id : null;
}

function getAllChannelMappings() {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM channel_map').all();
  const map = {};
  for (const row of rows) {
    map[row.channel_id] = row.repo;
  }
  return map;
}

// --- Proposals ---

function trackProposal(messageTs, data) {
  const db = getDb();
  db.prepare(`
    INSERT OR REPLACE INTO proposals (message_ts, proposed_path, target_dir, file_name)
    VALUES (?, ?, ?, ?)
  `).run(messageTs, data.proposedPath || null, data.targetDir || null, data.fileName || null);
}

function getProposal(messageTs) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM proposals WHERE message_ts = ?').get(messageTs);
  if (!row) return null;
  return {
    proposedPath: row.proposed_path,
    targetDir: row.target_dir,
    fileName: row.file_name,
    proposed_at: row.proposed_at
  };
}

function removeProposal(messageTs) {
  const db = getDb();
  db.prepare('DELETE FROM proposals WHERE message_ts = ?').run(messageTs);
}

// --- Session Log ---

function addSessionLog(missionId, entry) {
  const db = getDb();
  db.prepare(`
    INSERT INTO session_log (mission_id, session_id, agent, objective, exit_code, started_at, ended_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    missionId, entry.session_id || null, entry.agent || null,
    entry.objective || null, entry.exit_code ?? null,
    entry.started_at || null, entry.ended_at || null
  );
}

function getSessionLog(missionId) {
  const db = getDb();
  return db.prepare('SELECT * FROM session_log WHERE mission_id = ? ORDER BY id').all(missionId);
}

// --- Events (delegated to telemetry-db) ---

const tdb = require('./telemetry-db');

function logEvent(event, opts) {
  return tdb.logEvent(event, opts);
}

function getTimeline(missionId) {
  return tdb.getTimeline(missionId);
}

function recentEvents(limit = 30) {
  return tdb.recentEvents(limit);
}

// --- Orphaned missions ---

function getOrphanedMissions() {
  const db = getDb();
  const rows = db.prepare(`
    SELECT m.* FROM missions m
    LEFT JOIN threads t ON m.id = t.mission_id
    WHERE m.status IN ('in_progress', 'pending_approval', 'review', 'planning')
    AND t.mission_id IS NULL
  `).all();
  return rows.map(deserializeMission);
}

// --- Migration: JSON files → SQLite ---

function migrateFromJSON(stateDir) {
  const db = getDb();
  const migrated = { missions: 0, threads: 0, approvals: 0, channels: 0, proposals: 0 };

  const tx = db.transaction(() => {
    // Channel map
    const channelMapPath = path.join(stateDir, 'channel-map.json');
    try {
      const map = JSON.parse(fs.readFileSync(channelMapPath, 'utf-8'));
      for (const [channelId, repo] of Object.entries(map.channel_map || {})) {
        db.prepare('INSERT OR IGNORE INTO channel_map (channel_id, repo) VALUES (?, ?)').run(channelId, repo);
        migrated.channels++;
      }
    } catch { /* no channel map */ }

    // PR approvals
    const prApprovalsPath = path.join(stateDir, 'pr-approvals.json');
    try {
      const approvals = JSON.parse(fs.readFileSync(prApprovalsPath, 'utf-8'));
      for (const [ts, data] of Object.entries(approvals)) {
        db.prepare(`INSERT OR IGNORE INTO approvals (message_ts, type, repo, mission_id, pr_number, pr_url, channel, thread_ts, tracked_at)
          VALUES (?, 'pr', ?, ?, ?, ?, ?, ?, ?)`).run(
          ts, data.repo, data.mission_id, data.pr_number, data.pr_url, data.channel, data.thread_ts, data.tracked_at
        );
        migrated.approvals++;
      }
    } catch { /* no pr approvals */ }

    // Plan approvals
    const planApprovalsPath = path.join(stateDir, 'plan-approvals.json');
    try {
      const approvals = JSON.parse(fs.readFileSync(planApprovalsPath, 'utf-8'));
      for (const [ts, data] of Object.entries(approvals)) {
        db.prepare(`INSERT OR IGNORE INTO approvals (message_ts, type, repo, mission_id, channel, thread_ts, tracked_at)
          VALUES (?, 'plan', ?, ?, ?, ?, ?)`).run(
          ts, data.repo, data.mission_id, data.channel, data.thread_ts, data.tracked_at
        );
        migrated.approvals++;
      }
    } catch { /* no plan approvals */ }

    // Active threads
    const threadsPath = path.join(stateDir, 'active-threads.json');
    try {
      const threads = JSON.parse(fs.readFileSync(threadsPath, 'utf-8'));
      for (const [, data] of Object.entries(threads)) {
        db.prepare(`INSERT OR IGNORE INTO threads (channel, thread_ts, repo, mission_id, integration_branch, pr_number, pr_url, original_description, status, follow_up_count, tracked_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
          data.channel, data.thread_ts, data.repo, data.mission_id,
          data.integration_branch, data.pr_number, data.pr_url,
          data.original_description, data.status || 'idle', data.follow_up_count || 0,
          data.tracked_at, data.updated_at
        );
        migrated.threads++;
      }
    } catch { /* no threads */ }

    // Proposals
    const proposalsPath = path.join(stateDir, 'proposed', 'index.json');
    try {
      const proposals = JSON.parse(fs.readFileSync(proposalsPath, 'utf-8'));
      for (const [ts, data] of Object.entries(proposals)) {
        db.prepare(`INSERT OR IGNORE INTO proposals (message_ts, proposed_path, target_dir, file_name, proposed_at)
          VALUES (?, ?, ?, ?, ?)`).run(
          ts, data.proposedPath, data.targetDir, data.fileName, data.tracked_at
        );
        migrated.proposals++;
      }
    } catch { /* no proposals */ }

    // Missions (scan projects directory)
    const projectsDir = path.join(stateDir, 'projects');
    try {
      for (const repo of fs.readdirSync(projectsDir)) {
        const missionsDir = path.join(projectsDir, repo, 'missions');
        if (!fs.existsSync(missionsDir)) continue;
        for (const mid of fs.readdirSync(missionsDir)) {
          const missionFile = path.join(missionsDir, mid, 'mission.json');
          try {
            const m = JSON.parse(fs.readFileSync(missionFile, 'utf-8'));
            // Skip if already migrated
            const exists = db.prepare('SELECT 1 FROM missions WHERE id = ?').get(m.mission_id);
            if (exists) continue;

            db.prepare(`INSERT INTO missions (id, repo, description, status, default_branch, integration_branch, slack_channel, slack_thread_ts, pr_number, pr_url, pr_status, plan_message_ts, is_follow_up, parent_mission_id, config, safety, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
              m.mission_id, m.repo, m.description, m.status,
              m.default_branch || 'main', m.integration_branch || null,
              m.slack_channel || null, m.slack_thread_ts || null,
              m.pr?.number || null, m.pr?.url || null, m.pr?.status || null,
              m.plan_message_ts || null,
              m.is_follow_up ? 1 : 0, m.parent_mission_id || null,
              JSON.stringify(m.config || {}), JSON.stringify(m.safety || {}),
              m.created_at, m.updated_at
            );

            // Objectives from work_items
            if (m.work_items?.length) {
              const insertObj = db.prepare(`INSERT INTO objectives (id, mission_id, title, description, status, phase, parallel_group, assigned_to, git_branch, worker_index, risk_flags, depends_on, context_sources, evidence_path, reviewed_by, merged, started_at, completed_at, error)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
              for (const w of m.work_items) {
                insertObj.run(
                  w.id, m.mission_id, w.title || w.description || '', w.description || null,
                  w.status || 'ready', w.phase || 1, w.parallel_group || null,
                  w.assigned_to || null, w.git_branch || null, w.worker_index ?? null,
                  JSON.stringify(w.risk_flags || []), JSON.stringify(w.depends_on || []),
                  JSON.stringify(w.context_sources || []), w.evidence_path || null,
                  JSON.stringify(w.reviewed_by || []), w.merged ? 1 : 0,
                  w.started_at || null, w.completed_at || null, w.error || null
                );
              }
            }

            // Session log
            if (m.session_log?.length) {
              const insertLog = db.prepare(`INSERT INTO session_log (mission_id, session_id, agent, objective, exit_code, started_at, ended_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)`);
              for (const s of m.session_log) {
                insertLog.run(
                  m.mission_id, s.session_id || null, s.agent || null,
                  s.objective || null, s.exit_code ?? null,
                  s.started_at || null, s.ended_at || null
                );
              }
            }

            migrated.missions++;
          } catch { /* skip bad mission files */ }
        }
      }
    } catch { /* no projects dir */ }
  });

  tx();
  return migrated;
}

module.exports = {
  getDb,
  close,
  _resetForTest,

  // Missions
  createMission,
  getMission,
  updateMission,
  listMissionsByRepo,
  listMissionsByStatus,
  getLatestMission,
  findMission,
  listAllRepos,
  missionOverview,

  // Objectives
  setObjectives,
  getObjectives,
  getObjective,
  updateObjective,
  getReadyObjectives,
  getObjectivesByStatus,

  // Threads
  trackThread,
  getThread,
  updateThreadStatus,
  incrementFollowUp,
  removeThread,
  resetStaleThreads,
  listActiveThreads,

  // Approvals
  trackApproval,
  getApproval,
  removeApproval,
  listApprovalsByType,

  // Channel map
  setChannelMapping,
  getRepoForChannel,
  getChannelForRepo,
  getAllChannelMappings,

  // Proposals
  trackProposal,
  getProposal,
  removeProposal,

  // Session log
  addSessionLog,
  getSessionLog,

  // Events
  logEvent,
  getTimeline,
  recentEvents,

  // Queries
  getOrphanedMissions,

  // Migration
  migrateFromJSON
};
