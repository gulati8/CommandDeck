'use strict';

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

let _db = null;
let _dbPath = null;

// --- Schema ---

const SCHEMA = `
CREATE TABLE IF NOT EXISTS traces (
  trace_id    TEXT PRIMARY KEY,
  mission_id  TEXT,
  repo        TEXT,
  status      TEXT DEFAULT 'in_progress',
  started_at  TEXT,
  ended_at    TEXT,
  duration_ms INTEGER,
  span_count  INTEGER DEFAULT 0,
  spans       TEXT NOT NULL DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS idx_traces_mission ON traces(mission_id);
CREATE INDEX IF NOT EXISTS idx_traces_started ON traces(started_at);

CREATE TABLE IF NOT EXISTS events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ts          TEXT DEFAULT (datetime('now')),
  event       TEXT NOT NULL,
  mission_id  TEXT,
  repo        TEXT,
  actor       TEXT,
  payload     TEXT DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_events_mission ON events(mission_id);
CREATE INDEX IF NOT EXISTS idx_events_ts ON events(ts);

CREATE TABLE IF NOT EXISTS logs (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  ts           TEXT NOT NULL,
  trace_id     TEXT,
  span_id      TEXT,
  mission_id   TEXT,
  repo         TEXT,
  source       TEXT,
  agent        TEXT,
  objective_id TEXT,
  level        TEXT DEFAULT 'info',
  message      TEXT,
  data         TEXT DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_logs_trace ON logs(trace_id);
CREATE INDEX IF NOT EXISTS idx_logs_mission ON logs(mission_id);
CREATE INDEX IF NOT EXISTS idx_logs_ts ON logs(ts);
`;

// --- Init ---

function getStateDir() {
  return process.env.COMMANDDECK_STATE_DIR || path.join(process.env.HOME, '.commanddeck');
}

function getDb() {
  const stateDir = getStateDir();
  const dbPath = path.join(stateDir, 'telemetry.db');

  if (_db && _dbPath !== dbPath) {
    _db.close();
    _db = null;
    _dbPath = null;
  }

  if (_db) return _db;
  fs.mkdirSync(stateDir, { recursive: true });
  _db = new Database(dbPath);
  _dbPath = dbPath;
  _db.pragma('journal_mode = WAL');
  _db.exec(SCHEMA);
  return _db;
}

function close() {
  if (_db) {
    _db.close();
    _db = null;
    _dbPath = null;
  }
}

function _resetForTest(stateDir) {
  close();
  fs.mkdirSync(stateDir, { recursive: true });
  const dbPath = path.join(stateDir, 'telemetry.db');
  _db = new Database(dbPath);
  _dbPath = dbPath;
  _db.pragma('journal_mode = WAL');
  _db.exec(SCHEMA);
  return _db;
}

// --- Helpers ---

function jsonParse(val, fallback) {
  if (!val) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}

// --- Events (moved from app.db) ---

function logEvent(event, { mission_id, repo, actor, ...rest } = {}) {
  const entry = { ts: new Date().toISOString(), event, mission_id: mission_id || null, repo: repo || null };
  if (actor) entry.actor = actor;
  if (Object.keys(rest).length) Object.assign(entry, rest);
  console.log(JSON.stringify(entry));
  const db = getDb();
  db.prepare(`
    INSERT INTO events (event, mission_id, repo, actor, payload)
    VALUES (?, ?, ?, ?, ?)
  `).run(event, mission_id || null, repo || null, actor || null, JSON.stringify(rest));
}

function getTimeline(missionId) {
  const db = getDb();
  return db.prepare('SELECT * FROM events WHERE mission_id = ? ORDER BY ts DESC').all(missionId)
    .map(row => ({
      id: row.id,
      ts: row.ts,
      event: row.event,
      mission_id: row.mission_id,
      repo: row.repo,
      actor: row.actor,
      payload: jsonParse(row.payload, {})
    }));
}

function recentEvents(limit = 30) {
  const db = getDb();
  return db.prepare('SELECT * FROM events ORDER BY ts DESC LIMIT ?').all(limit)
    .map(row => ({
      id: row.id,
      ts: row.ts,
      event: row.event,
      mission_id: row.mission_id,
      repo: row.repo,
      actor: row.actor,
      payload: jsonParse(row.payload, {})
    }));
}

// --- Traces ---

function upsertTrace(traceData) {
  const db = getDb();
  db.prepare(`
    INSERT INTO traces (trace_id, mission_id, repo, status, started_at, ended_at, duration_ms, span_count, spans)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(trace_id) DO UPDATE SET
      status = excluded.status,
      ended_at = excluded.ended_at,
      duration_ms = excluded.duration_ms,
      span_count = excluded.span_count,
      spans = excluded.spans
  `).run(
    traceData.trace_id,
    traceData.mission_id || null,
    traceData.repo || null,
    traceData.status || 'in_progress',
    traceData.started_at || null,
    traceData.ended_at || null,
    traceData.duration_ms || null,
    traceData.span_count || 0,
    JSON.stringify(traceData.spans || [])
  );
}

function getTrace(traceId) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM traces WHERE trace_id = ?').get(traceId);
  if (!row) return null;
  return {
    trace_id: row.trace_id,
    mission_id: row.mission_id,
    repo: row.repo,
    status: row.status,
    started_at: row.started_at,
    ended_at: row.ended_at,
    duration_ms: row.duration_ms,
    span_count: row.span_count,
    spans: jsonParse(row.spans, [])
  };
}

function listTraces({ limit = 50, status, repo, mission_id } = {}) {
  const db = getDb();
  const conditions = [];
  const params = [];

  if (status) { conditions.push('status = ?'); params.push(status); }
  if (repo) { conditions.push('repo = ?'); params.push(repo); }
  if (mission_id) { conditions.push('mission_id = ?'); params.push(mission_id); }

  const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';
  params.push(limit);

  return db.prepare(`SELECT * FROM traces${where} ORDER BY started_at DESC LIMIT ?`).all(...params)
    .map(row => ({
      trace_id: row.trace_id,
      mission_id: row.mission_id,
      repo: row.repo,
      status: row.status,
      started_at: row.started_at,
      ended_at: row.ended_at,
      duration_ms: row.duration_ms,
      span_count: row.span_count,
      spans: jsonParse(row.spans, [])
    }));
}

function getTraceByMission(missionId) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM traces WHERE mission_id = ? ORDER BY started_at DESC LIMIT 1').get(missionId);
  if (!row) return null;
  return {
    trace_id: row.trace_id,
    mission_id: row.mission_id,
    repo: row.repo,
    status: row.status,
    started_at: row.started_at,
    ended_at: row.ended_at,
    duration_ms: row.duration_ms,
    span_count: row.span_count,
    spans: jsonParse(row.spans, [])
  };
}

// --- Logs ---

function writeLog(entry) {
  const db = getDb();
  db.prepare(`
    INSERT INTO logs (ts, trace_id, span_id, mission_id, repo, source, agent, objective_id, level, message, data)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    entry.ts || new Date().toISOString(),
    entry.trace_id || null,
    entry.span_id || null,
    entry.mission_id || null,
    entry.repo || null,
    entry.source || null,
    entry.agent || null,
    entry.objective_id || null,
    entry.level || 'info',
    entry.message || null,
    JSON.stringify(entry.data || {})
  );
}

function queryLogs({ mission_id, trace_id, since, level, source, limit = 100 } = {}) {
  const db = getDb();
  const conditions = [];
  const params = [];

  if (mission_id) { conditions.push('mission_id = ?'); params.push(mission_id); }
  if (trace_id) { conditions.push('trace_id = ?'); params.push(trace_id); }
  if (since) { conditions.push('ts > ?'); params.push(since); }
  if (level) { conditions.push('level = ?'); params.push(level); }
  if (source) { conditions.push('source = ?'); params.push(source); }

  const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';
  params.push(limit);

  return db.prepare(`SELECT * FROM logs${where} ORDER BY ts DESC LIMIT ?`).all(...params)
    .map(row => ({
      id: row.id,
      ts: row.ts,
      trace_id: row.trace_id,
      span_id: row.span_id,
      mission_id: row.mission_id,
      repo: row.repo,
      source: row.source,
      agent: row.agent,
      objective_id: row.objective_id,
      level: row.level,
      message: row.message,
      data: jsonParse(row.data, {})
    }));
}

// --- Metrics (computed aggregates) ---

function getMetrics() {
  const db = getDb();

  const total = db.prepare('SELECT COUNT(*) as count FROM traces').get().count;
  const completed = db.prepare("SELECT COUNT(*) as count FROM traces WHERE status = 'completed'").get().count;
  const failed = db.prepare("SELECT COUNT(*) as count FROM traces WHERE status = 'error'").get().count;
  const inProgress = db.prepare("SELECT COUNT(*) as count FROM traces WHERE status = 'in_progress'").get().count;
  const avgDuration = db.prepare("SELECT AVG(duration_ms) as avg FROM traces WHERE status = 'completed' AND duration_ms IS NOT NULL").get().avg;

  // Missions by status (from events)
  const byStatus = db.prepare(`
    SELECT
      CASE
        WHEN event LIKE '%completed%' OR event LIKE '%done%' THEN 'completed'
        WHEN event LIKE '%failed%' THEN 'failed'
        WHEN event LIKE '%started%' OR event LIKE '%created%' THEN 'started'
        ELSE 'other'
      END as category,
      COUNT(*) as count
    FROM events
    GROUP BY category
  `).all();

  // Recent trace durations for trend
  const durationTrend = db.prepare(`
    SELECT started_at, duration_ms, repo
    FROM traces
    WHERE status = 'completed' AND duration_ms IS NOT NULL
    ORDER BY started_at DESC
    LIMIT 20
  `).all();

  // Most active agents
  const topAgents = db.prepare(`
    SELECT agent, COUNT(*) as count
    FROM logs
    WHERE agent IS NOT NULL
    GROUP BY agent
    ORDER BY count DESC
    LIMIT 10
  `).all();

  return {
    traces: { total, completed, failed, in_progress: inProgress },
    avg_duration_ms: avgDuration ? Math.round(avgDuration) : null,
    by_status: byStatus,
    duration_trend: durationTrend,
    top_agents: topAgents
  };
}

// --- Migration: events from app.db → telemetry.db ---

function migrateEventsFromAppDb() {
  const stateDir = getStateDir();
  const appDbPath = path.join(stateDir, 'app.db');
  if (!fs.existsSync(appDbPath)) return 0;

  let appDb;
  try {
    appDb = new Database(appDbPath, { readonly: true });
  } catch {
    return 0;
  }

  // Check if events table exists in app.db
  const hasEvents = appDb.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='events'"
  ).get();
  if (!hasEvents) {
    appDb.close();
    return 0;
  }

  const rows = appDb.prepare('SELECT * FROM events ORDER BY id').all();
  appDb.close();

  if (!rows.length) return 0;

  const db = getDb();
  const existingCheck = db.prepare('SELECT 1 FROM events WHERE ts = ? AND event = ? LIMIT 1');
  const insert = db.prepare(`
    INSERT INTO events (ts, event, mission_id, repo, actor, payload)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  let migrated = 0;
  const tx = db.transaction(() => {
    for (const row of rows) {
      if (existingCheck.get(row.ts, row.event)) continue;
      insert.run(row.ts, row.event, row.mission_id, row.repo, row.actor, row.payload || '{}');
      migrated++;
    }
  });
  tx();

  // Drop events table from app.db to prevent confusion
  if (migrated > 0) {
    try {
      const appDbRw = new Database(appDbPath);
      appDbRw.exec('DROP TABLE IF EXISTS events');
      appDbRw.close();
    } catch { /* ok if read-only or locked */ }
  }

  return migrated;
}

module.exports = {
  getDb,
  close,
  _resetForTest,

  // Events (moved from app.db)
  logEvent,
  getTimeline,
  recentEvents,

  // Migration
  migrateEventsFromAppDb,

  // Traces
  upsertTrace,
  getTrace,
  listTraces,
  getTraceByMission,

  // Logs
  writeLog,
  queryLogs,

  // Metrics
  getMetrics
};
