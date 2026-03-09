'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Set up temp state dir before requiring modules
const tmpDir = path.join(os.tmpdir(), `dashboard-test-${Date.now()}`);
process.env.COMMANDDECK_STATE_DIR = tmpDir;
process.env.COMMANDDECK_PROJECT_DIR = path.join(tmpDir, 'projects-dir');
process.env.DOCKER_SOCKET = '/nonexistent/docker.sock';
process.env.Q_HOST = '127.0.0.254'; // unreachable

const db = require('../lib/db');

function makeRequest(port, reqPath, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port,
      path: reqPath,
      method
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, headers: res.headers, body: data });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// Seed test data into SQLite + filesystem (for file artifacts)
function seedState() {
  // Ensure state dir exists and init DB
  fs.mkdirSync(tmpDir, { recursive: true });
  db.getDb();

  // Create mission in SQLite
  db.createMission('mission-20260228-001', {
    repo: 'test-repo',
    description: 'Test mission for dashboard',
    defaultBranch: 'main',
    integrationBranch: 'commanddeck/mission-20260228-001/integration',
    slackChannel: 'C123',
    slackThreadTs: '1234567890.123',
    safety: {
      max_sessions: 50,
      max_elapsed_hours: 6,
      max_parallel_workers: 3,
      session_count: 5,
      started_at: '2026-02-28T10:00:00Z'
    }
  });

  // Update mission status to in_progress
  db.updateMission('mission-20260228-001', { status: 'in_progress' });

  // Add objectives
  db.setObjectives('mission-20260228-001', [
    {
      id: 'obj-1',
      title: 'Implement feature A',
      status: 'done',
      phase: 1,
      depends_on: [],
      assigned_to: 'borg',
      risk_flags: ['dependency'],
      worker_index: 0
    },
    {
      id: 'obj-2',
      title: 'Implement feature B',
      status: 'in_progress',
      phase: 1,
      depends_on: [],
      assigned_to: 'borg',
      risk_flags: [],
      worker_index: 1
    }
  ]);

  // Add session log
  db.addSessionLog('mission-20260228-001', {
    session_id: 'sess-001',
    started_at: '2026-02-28T10:00:00Z',
    ended_at: '2026-02-28T10:05:00Z',
    agent: 'captain-picard',
    objective: 'planning',
    exit_code: 0
  });

  // Channel map
  db.setChannelMapping('C123', 'test-repo');
  db.setChannelMapping('C456', 'channel-only-repo');

  // PR approval
  db.trackApproval('1234567890.123', 'pr', {
    repo: 'test-repo',
    mission_id: 'mission-20260228-001',
    pr_number: 42,
    pr_url: 'https://github.com/test/test-repo/pull/42',
    channel: 'C123'
  });

  // File artifacts (evidence, health alerts) — still on filesystem
  const projectDir = path.join(tmpDir, 'projects', 'test-repo', 'missions', 'mission-20260228-001');
  fs.mkdirSync(path.join(projectDir, 'artifacts'), { recursive: true });
  fs.mkdirSync(path.join(projectDir, 'briefings'), { recursive: true });

  const evidence = {
    objective_id: 'obj-1',
    agent: 'borg',
    summary: 'Implemented feature A',
    files_changed: { created: ['src/a.js'], modified: [], deleted: [] },
    tests: { result: 'pass' }
  };
  fs.writeFileSync(path.join(projectDir, 'artifacts', 'evidence-obj-1.json'), JSON.stringify(evidence));

  const alerts = [
    '{"ts":"2026-02-28T10:20:00Z","level":"warning","objective":"obj-2","type":"slow_progress","message":"No commits in 10 minutes"}'
  ];
  fs.writeFileSync(path.join(projectDir, 'artifacts', 'health-alerts.ndjson'), alerts.join('\n') + '\n');

  // Project config (filesystem)
  fs.writeFileSync(path.join(tmpDir, 'projects', 'test-repo', 'config.json'), JSON.stringify({
    default_branch: 'main',
    max_workers: 2
  }));

  // Global config (filesystem)
  fs.writeFileSync(path.join(tmpDir, 'config.json'), JSON.stringify({
    github_org: 'testorg',
    domain: 'test.dev'
  }));

  // Second mission in a different repo (no health alerts)
  db.createMission('mission-20260228-002', {
    repo: 'test-repo2',
    description: 'Second test mission',
    defaultBranch: 'main'
  });

  // Second project with no missions (filesystem only — empty-repo)
  fs.mkdirSync(path.join(tmpDir, 'projects', 'empty-repo', 'missions'), { recursive: true });
}

describe('dashboard server', () => {
  let server;
  let port;

  before(async () => {
    seedState();
    const { createHTTPServer } = require('../server');
    server = createHTTPServer(null);
    await new Promise((resolve) => {
      server.listen(0, () => {
        port = server.address().port;
        resolve();
      });
    });
  });

  after(() => {
    if (server) server.close();
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('static files', () => {
    it('GET / returns 200 with HTML', async () => {
      const res = await makeRequest(port, '/');
      assert.equal(res.statusCode, 200);
      assert.ok(res.headers['content-type'].includes('text/html'));
      assert.ok(res.body.includes('CommandDeck'));
    });

    it('GET /style.css returns 200 with CSS', async () => {
      const res = await makeRequest(port, '/style.css');
      assert.equal(res.statusCode, 200);
      assert.ok(res.headers['content-type'].includes('text/css'));
    });

    it('GET /app.js returns 200 with JavaScript', async () => {
      const res = await makeRequest(port, '/app.js');
      assert.equal(res.statusCode, 200);
      assert.ok(res.headers['content-type'].includes('application/javascript'));
    });

    it('GET /nonexistent returns 404', async () => {
      const res = await makeRequest(port, '/nonexistent.html');
      assert.equal(res.statusCode, 404);
    });
  });

  describe('GET /api/health', () => {
    it('returns 200 with status ok and uptime', async () => {
      const res = await makeRequest(port, '/api/health');
      assert.equal(res.statusCode, 200);
      const json = JSON.parse(res.body);
      assert.equal(json.status, 'ok');
      assert.equal(typeof json.uptime, 'number');
      assert.ok(json.uptime > 0);
    });
  });

  describe('GET /api/overview', () => {
    it('returns project and mission counts with config', async () => {
      const res = await makeRequest(port, '/api/overview');
      assert.equal(res.statusCode, 200);
      const json = JSON.parse(res.body);
      // 4 projects: test-repo, test-repo2 (SQLite), channel-only-repo (channel map), empty-repo (fs)
      assert.equal(json.projects, 4);
      // 2 active: mission-001 (in_progress), mission-002 (planning)
      assert.equal(json.active_missions, 2);
      assert.equal(json.total_missions, 2);
      assert.equal(json.config.github_org, 'testorg');
      assert.equal(json.config.domain, 'test.dev');
      assert.equal(typeof json.uptime, 'number');
    });
  });

  describe('GET /api/projects', () => {
    it('returns array of projects with channel and mission info', async () => {
      const res = await makeRequest(port, '/api/projects');
      assert.equal(res.statusCode, 200);
      const json = JSON.parse(res.body);
      assert.ok(Array.isArray(json));
      assert.equal(json.length, 4);

      const testRepo = json.find(p => p.repo === 'test-repo');
      assert.ok(testRepo);
      assert.equal(testRepo.channel_id, 'C123');
      assert.equal(testRepo.mission_count, 1);
      assert.equal(testRepo.config.max_workers, 2);

      const emptyRepo = json.find(p => p.repo === 'empty-repo');
      assert.ok(emptyRepo);
      assert.equal(emptyRepo.mission_count, 0);

      const channelOnly = json.find(p => p.repo === 'channel-only-repo');
      assert.ok(channelOnly);
      assert.equal(channelOnly.channel_id, 'C456');
      assert.equal(channelOnly.mission_count, 0);
    });
  });

  describe('GET /api/projects/:repo/missions', () => {
    it('returns missions for a project', async () => {
      const res = await makeRequest(port, '/api/projects/test-repo/missions');
      assert.equal(res.statusCode, 200);
      const json = JSON.parse(res.body);
      assert.ok(Array.isArray(json));
      assert.equal(json.length, 1);
      assert.equal(json[0].mission_id, 'mission-20260228-001');
      assert.equal(json[0].status, 'in_progress');
      assert.equal(json[0].progress.done, 1);
      assert.equal(json[0].progress.total, 2);
      assert.equal(json[0].progress.percent, 50);
      assert.ok(json[0].pr);
    });

    it('returns empty array for project with no missions', async () => {
      const res = await makeRequest(port, '/api/projects/empty-repo/missions');
      assert.equal(res.statusCode, 200);
      const json = JSON.parse(res.body);
      assert.deepEqual(json, []);
    });

    it('returns empty array for nonexistent project', async () => {
      const res = await makeRequest(port, '/api/projects/nope/missions');
      assert.equal(res.statusCode, 200);
      const json = JSON.parse(res.body);
      assert.deepEqual(json, []);
    });
  });

  describe('GET /api/missions/:repo/:missionId', () => {
    it('returns full mission detail with evidence and health alerts', async () => {
      const res = await makeRequest(port, '/api/missions/test-repo/mission-20260228-001');
      assert.equal(res.statusCode, 200);
      const json = JSON.parse(res.body);
      assert.equal(json.mission_id, 'mission-20260228-001');
      assert.equal(json.status, 'in_progress');
      assert.equal(json.progress.done, 1);
      assert.equal(json.work_items.length, 2);

      // Evidence attached to obj-1
      const obj1 = json.work_items.find(w => w.id === 'obj-1');
      assert.ok(obj1.evidence);
      assert.equal(obj1.evidence.tests.result, 'pass');

      // obj-2 has no evidence
      const obj2 = json.work_items.find(w => w.id === 'obj-2');
      assert.equal(obj2.evidence, null);

      // Health alerts
      assert.equal(json.health_alerts.length, 1);
      assert.equal(json.health_alerts[0].type, 'slow_progress');

      // Session log
      assert.equal(json.session_log.length, 1);
      assert.equal(json.session_log[0].agent, 'captain-picard');
    });

    it('returns 404 for nonexistent mission', async () => {
      const res = await makeRequest(port, '/api/missions/test-repo/nope');
      assert.equal(res.statusCode, 404);
      const json = JSON.parse(res.body);
      assert.equal(json.error, 'mission not found');
    });
  });

  describe('GET /api/pending', () => {
    it('returns pending actions with PR approvals', async () => {
      const res = await makeRequest(port, '/api/pending');
      assert.equal(res.statusCode, 200);
      const json = JSON.parse(res.body);
      assert.ok(Array.isArray(json.pr_approvals));
      assert.equal(json.pr_approvals.length, 1);
      assert.equal(json.pr_approvals[0].repo, 'test-repo');
      assert.equal(json.pr_approvals[0].pr_number, 42);
      assert.ok(Array.isArray(json.plan_approvals));
      assert.ok(Array.isArray(json.active_threads));
    });
  });

  describe('health alerts in mission detail', () => {
    it('returns health alerts embedded in mission detail', async () => {
      const res = await makeRequest(port, `/api/missions/test-repo/mission-20260228-001`);
      assert.equal(res.statusCode, 200);
      const json = JSON.parse(res.body);
      assert.ok(Array.isArray(json.health_alerts));
      assert.equal(json.health_alerts.length, 1);
      assert.equal(json.health_alerts[0].type, 'slow_progress');
    });

    it('returns empty alerts for mission without alerts', async () => {
      const res = await makeRequest(port, `/api/missions/test-repo2/mission-20260228-002`);
      assert.equal(res.statusCode, 200);
      const json = JSON.parse(res.body);
      assert.ok(Array.isArray(json.health_alerts));
      assert.equal(json.health_alerts.length, 0);
    });
  });

  describe('GET /api/containers', () => {
    it('returns empty array when docker socket unavailable', async () => {
      const res = await makeRequest(port, '/api/containers');
      assert.equal(res.statusCode, 200);
      const json = JSON.parse(res.body);
      assert.ok(Array.isArray(json));
      assert.equal(json.length, 0);
    });
  });

  describe('GET /api/overview active_workers', () => {
    it('returns active_workers count', async () => {
      const res = await makeRequest(port, '/api/overview');
      assert.equal(res.statusCode, 200);
      const json = JSON.parse(res.body);
      assert.equal(typeof json.active_workers, 'number');
      // obj-2 is in_progress in our test mission
      assert.equal(json.active_workers, 1);
    });
  });

  describe('method handling', () => {
    it('POST to unknown API route returns 404', async () => {
      const res = await new Promise((resolve, reject) => {
        const req = http.request({
          hostname: 'localhost',
          port,
          path: '/api/unknown-route',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        }, (r) => {
          let data = '';
          r.on('data', chunk => { data += chunk; });
          r.on('end', () => resolve({ statusCode: r.statusCode, body: data }));
        });
        req.on('error', reject);
        req.end('{}');
      });
      assert.equal(res.statusCode, 404);
    });

    it('PUT returns 405', async () => {
      const res = await makeRequest(port, '/api/health', 'PUT');
      assert.equal(res.statusCode, 405);
    });
  });

  describe('unknown API routes', () => {
    it('returns 404 for unknown API path', async () => {
      const res = await makeRequest(port, '/api/unknown');
      assert.equal(res.statusCode, 404);
      const json = JSON.parse(res.body);
      assert.equal(json.error, 'not found');
    });
  });
});
