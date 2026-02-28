'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const state = require('../lib/state');

const CHANNEL_MAP_PATH = process.env.COMMANDDECK_CHANNEL_MAP
  || path.join(state.STATE_DIR, 'channel-map.json');
const PR_APPROVALS_PATH = path.join(state.STATE_DIR, 'pr-approvals.json');
const PLAN_APPROVALS_PATH = path.join(state.STATE_DIR, 'plan-approvals.json');
const THREADS_PATH = path.join(state.STATE_DIR, 'active-threads.json');

function readJSON(filePath, fallback) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf-8')); }
  catch { return fallback; }
}

const PORT = parseInt(process.env.DASHBOARD_PORT || '3002', 10);
const STATIC_DIR = path.join(__dirname, 'public');

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function sendJSON(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function serveStatic(pathname, res) {
  if (pathname === '/') pathname = '/index.html';
  const filePath = path.join(STATIC_DIR, pathname);

  // Prevent directory traversal
  if (!filePath.startsWith(STATIC_DIR)) {
    res.writeHead(403);
    res.end();
    return;
  }

  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  try {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  } catch {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not found' }));
  }
}

// Enumerate projects from state dir
function listStateProjects() {
  const projectsDir = path.join(state.STATE_DIR, 'projects');
  try {
    return fs.readdirSync(projectsDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);
  } catch {
    return [];
  }
}

// All known projects: state dir + channel map (deduped)
function listAllProjects() {
  const stateProjects = new Set(listStateProjects());
  const channelMap = readJSON(CHANNEL_MAP_PATH, { channel_map: {} });
  for (const repo of Object.values(channelMap.channel_map || {})) {
    stateProjects.add(repo);
  }
  return [...stateProjects].sort();
}

// List mission IDs for a project
function listMissionIds(repo) {
  const missionsDir = path.join(state.STATE_DIR, 'projects', repo, 'missions');
  try {
    return fs.readdirSync(missionsDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);
  } catch {
    return [];
  }
}

function addProgress(mission) {
  const done = mission.work_items.filter(w => w.status === 'done').length;
  const total = mission.work_items.length;
  return {
    ...mission,
    progress: { done, total, percent: total > 0 ? Math.round((done / total) * 100) : 0 }
  };
}

// Read health alerts NDJSON
function readHealthAlerts(repo, missionId) {
  const alertPath = path.join(
    state.STATE_DIR, 'projects', repo, 'missions', missionId,
    'artifacts', 'health-alerts.ndjson'
  );
  try {
    return fs.readFileSync(alertPath, 'utf-8')
      .split('\n')
      .filter(Boolean)
      .map(line => JSON.parse(line));
  } catch {
    return [];
  }
}

// Read evidence bundle for an objective
function readEvidence(repo, missionId, objectiveId) {
  const evidencePath = path.join(
    state.STATE_DIR, 'projects', repo, 'missions', missionId,
    'artifacts', `evidence-${objectiveId}.json`
  );
  try {
    return JSON.parse(fs.readFileSync(evidencePath, 'utf-8'));
  } catch {
    return null;
  }
}

// --- API handlers ---

function handleOverview() {
  const globalConfig = state.loadGlobalConfig();
  const projects = listAllProjects();

  let activeMissions = 0;
  let totalMissions = 0;

  for (const repo of projects) {
    for (const mid of listMissionIds(repo)) {
      totalMissions++;
      const m = state.readMissionUnsafe(repo, mid);
      if (m && ['planning', 'in_progress', 'pending_approval', 'review'].includes(m.status)) {
        activeMissions++;
      }
    }
  }

  return {
    uptime: process.uptime(),
    projects: projects.length,
    active_missions: activeMissions,
    total_missions: totalMissions,
    config: {
      github_org: globalConfig.github_org,
      domain: globalConfig.domain
    }
  };
}

function handleProjects() {
  const projects = listAllProjects();
  const channelMap = readJSON(CHANNEL_MAP_PATH, { channel_map: {} });
  const reverseMap = {};
  for (const [ch, repo] of Object.entries(channelMap.channel_map || {})) {
    reverseMap[repo] = ch;
  }

  return projects.map(repo => {
    const config = state.loadProjectConfig(repo);
    const missionIds = listMissionIds(repo);
    return {
      repo,
      channel_id: reverseMap[repo] || null,
      mission_count: missionIds.length,
      config: {
        default_branch: config.default_branch,
        max_workers: config.max_workers
      }
    };
  });
}

function handleProjectMissions(repo) {
  const missionIds = listMissionIds(repo);
  if (missionIds.length === 0) return [];

  return missionIds.map(mid => {
    const m = state.readMissionUnsafe(repo, mid);
    if (!m) return null;
    const p = addProgress(m);
    return {
      mission_id: m.mission_id,
      description: m.description,
      status: m.status,
      progress: p.progress,
      created_at: m.created_at,
      updated_at: m.updated_at,
      pr: m.pr || null,
      slack_channel: m.slack_channel,
      slack_thread_ts: m.slack_thread_ts
    };
  }).filter(Boolean).sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
}

function handleMissionDetail(repo, missionId) {
  const m = state.readMissionUnsafe(repo, missionId);
  if (!m) return null;

  const p = addProgress(m);

  // Attach evidence to each work item
  const workItems = (m.work_items || []).map(item => {
    const ev = readEvidence(repo, missionId, item.id);
    return { ...item, evidence: ev };
  });

  return {
    ...p,
    work_items: workItems,
    health_alerts: readHealthAlerts(repo, missionId)
  };
}

function handlePending() {
  const prApprovals = readJSON(PR_APPROVALS_PATH, {});
  const planApprovals = readJSON(PLAN_APPROVALS_PATH, {});
  const threads = readJSON(THREADS_PATH, {});

  return {
    pr_approvals: Object.entries(prApprovals).map(([ts, data]) => ({
      message_ts: ts,
      ...data
    })),
    plan_approvals: Object.entries(planApprovals).map(([ts, data]) => ({
      message_ts: ts,
      ...data
    })),
    active_threads: Object.entries(threads)
      .filter(([, t]) => t.status !== 'idle')
      .map(([key, data]) => ({ key, ...data }))
  };
}

// --- Route matching ---

function matchRoute(pathname) {
  // /api/projects/:repo/missions
  let m = pathname.match(/^\/api\/projects\/([^/]+)\/missions$/);
  if (m) return { handler: 'projectMissions', repo: decodeURIComponent(m[1]) };

  // /api/missions/:repo/:missionId
  m = pathname.match(/^\/api\/missions\/([^/]+)\/([^/]+)$/);
  if (m) return { handler: 'missionDetail', repo: decodeURIComponent(m[1]), missionId: decodeURIComponent(m[2]) };

  // /api/health-alerts/:repo/:missionId
  m = pathname.match(/^\/api\/health-alerts\/([^/]+)\/([^/]+)$/);
  if (m) return { handler: 'healthAlerts', repo: decodeURIComponent(m[1]), missionId: decodeURIComponent(m[2]) };

  return null;
}

function handleAPI(url, res) {
  try {
    const pathname = url.pathname;

    if (pathname === '/api/health') {
      return sendJSON(res, 200, { status: 'ok', uptime: process.uptime() });
    }
    if (pathname === '/api/overview') {
      return sendJSON(res, 200, handleOverview());
    }
    if (pathname === '/api/projects') {
      return sendJSON(res, 200, handleProjects());
    }
    if (pathname === '/api/pending') {
      return sendJSON(res, 200, handlePending());
    }

    const route = matchRoute(pathname);
    if (route) {
      if (route.handler === 'projectMissions') {
        return sendJSON(res, 200, handleProjectMissions(route.repo));
      }
      if (route.handler === 'missionDetail') {
        const detail = handleMissionDetail(route.repo, route.missionId);
        if (!detail) return sendJSON(res, 404, { error: 'mission not found' });
        return sendJSON(res, 200, detail);
      }
      if (route.handler === 'healthAlerts') {
        return sendJSON(res, 200, readHealthAlerts(route.repo, route.missionId));
      }
    }

    sendJSON(res, 404, { error: 'not found' });
  } catch (err) {
    console.error('API error:', err.message);
    sendJSON(res, 500, { error: 'internal server error' });
  }
}

const server = http.createServer((req, res) => {
  if (req.method !== 'GET') {
    return sendJSON(res, 405, { error: 'method not allowed' });
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname.startsWith('/api/')) {
    return handleAPI(url, res);
  }

  serveStatic(url.pathname, res);
});

server.on('error', (err) => {
  console.error('Dashboard server error:', err.message);
});

function start(port) {
  const p = port !== undefined ? port : PORT;
  server.listen(p, () => {
    console.log(`CommandDeck dashboard listening on port ${server.address().port}`);
  });
  return server;
}

// Start if run directly
if (require.main === module) {
  start();
}

module.exports = { start, server };
