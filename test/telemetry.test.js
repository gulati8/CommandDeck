'use strict';

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const TEST_STATE_DIR = path.join(os.tmpdir(), `commanddeck-telemetry-test-${Date.now()}`);
process.env.COMMANDDECK_STATE_DIR = TEST_STATE_DIR;
// Disable socket for tests
process.env.COMMANDDECK_TELEMETRY_SOCKET = path.join(TEST_STATE_DIR, 'test-telemetry.sock');

const tdb = require('../lib/telemetry-db');

describe('telemetry-db', () => {
  before(() => {
    fs.mkdirSync(TEST_STATE_DIR, { recursive: true });
    tdb._resetForTest(TEST_STATE_DIR);
  });

  after(() => {
    tdb.close();
    fs.rmSync(TEST_STATE_DIR, { recursive: true, force: true });
  });

  describe('events', () => {
    it('should log and retrieve events', () => {
      tdb.logEvent('mission.created', {
        mission_id: 'test-001',
        repo: 'test-repo',
        actor: 'captain-picard',
        description: 'Build a widget'
      });

      const events = tdb.recentEvents(10);
      assert.ok(events.length >= 1);
      const ev = events[0];
      assert.equal(ev.event, 'mission.created');
      assert.equal(ev.mission_id, 'test-001');
      assert.equal(ev.repo, 'test-repo');
      assert.equal(ev.actor, 'captain-picard');
      assert.equal(ev.payload.description, 'Build a widget');
    });

    it('should get timeline for a mission', () => {
      tdb.logEvent('worker.started', { mission_id: 'test-001', repo: 'test-repo', actor: 'riker' });
      tdb.logEvent('worker.completed', { mission_id: 'test-001', repo: 'test-repo', actor: 'riker' });

      const timeline = tdb.getTimeline('test-001');
      assert.ok(timeline.length >= 2);
      assert.equal(timeline[0].mission_id, 'test-001');
    });
  });

  describe('traces', () => {
    it('should upsert and retrieve a trace', () => {
      const traceData = {
        trace_id: 'trace-001',
        mission_id: 'mission-001',
        repo: 'test-repo',
        status: 'in_progress',
        started_at: new Date().toISOString(),
        span_count: 3,
        spans: [
          { span_id: 'span-1', name: 'mission', status: 'ok', children: [
            { span_id: 'span-2', name: 'decompose', status: 'ok', children: [] }
          ]}
        ]
      };

      tdb.upsertTrace(traceData);

      const trace = tdb.getTrace('trace-001');
      assert.ok(trace);
      assert.equal(trace.trace_id, 'trace-001');
      assert.equal(trace.mission_id, 'mission-001');
      assert.equal(trace.status, 'in_progress');
      assert.equal(trace.spans.length, 1);
      assert.equal(trace.spans[0].children.length, 1);
    });

    it('should update trace on upsert', () => {
      tdb.upsertTrace({
        trace_id: 'trace-001',
        mission_id: 'mission-001',
        repo: 'test-repo',
        status: 'completed',
        started_at: new Date().toISOString(),
        ended_at: new Date().toISOString(),
        duration_ms: 5000,
        span_count: 5,
        spans: []
      });

      const trace = tdb.getTrace('trace-001');
      assert.equal(trace.status, 'completed');
      assert.equal(trace.duration_ms, 5000);
      assert.equal(trace.span_count, 5);
    });

    it('should list traces with filters', () => {
      tdb.upsertTrace({
        trace_id: 'trace-002',
        mission_id: 'mission-002',
        repo: 'other-repo',
        status: 'error',
        started_at: new Date().toISOString(),
        spans: []
      });

      const all = tdb.listTraces();
      assert.ok(all.length >= 2);

      const byRepo = tdb.listTraces({ repo: 'other-repo' });
      assert.ok(byRepo.length >= 1);
      assert.ok(byRepo.every(t => t.repo === 'other-repo'));

      const byStatus = tdb.listTraces({ status: 'error' });
      assert.ok(byStatus.length >= 1);
      assert.ok(byStatus.every(t => t.status === 'error'));
    });

    it('should get trace by mission ID', () => {
      const trace = tdb.getTraceByMission('mission-001');
      assert.ok(trace);
      assert.equal(trace.mission_id, 'mission-001');
    });
  });

  describe('logs', () => {
    it('should write and query logs', () => {
      tdb.writeLog({
        ts: new Date().toISOString(),
        trace_id: 'trace-001',
        span_id: 'span-1',
        mission_id: 'mission-001',
        repo: 'test-repo',
        source: 'hook',
        agent: 'riker',
        level: 'info',
        message: 'tool: Edit (src/app.js)',
        data: { tool: 'Edit', input: 'src/app.js' }
      });

      const logs = tdb.queryLogs({ mission_id: 'mission-001' });
      assert.ok(logs.length >= 1);
      assert.equal(logs[0].source, 'hook');
      assert.equal(logs[0].agent, 'riker');
      assert.equal(logs[0].data.tool, 'Edit');
    });

    it('should filter logs by source and level', () => {
      tdb.writeLog({
        ts: new Date().toISOString(),
        mission_id: 'mission-001',
        source: 'system',
        level: 'error',
        message: 'worker failed'
      });

      const errorLogs = tdb.queryLogs({ level: 'error' });
      assert.ok(errorLogs.length >= 1);
      assert.ok(errorLogs.every(l => l.level === 'error'));

      const systemLogs = tdb.queryLogs({ source: 'system' });
      assert.ok(systemLogs.length >= 1);
    });
  });

  describe('metrics', () => {
    it('should return computed metrics', () => {
      const metrics = tdb.getMetrics();
      assert.ok(metrics);
      assert.ok('traces' in metrics);
      assert.ok(metrics.traces.total >= 2);
      assert.ok('avg_duration_ms' in metrics);
      assert.ok(Array.isArray(metrics.duration_trend));
      assert.ok(Array.isArray(metrics.top_agents));
    });
  });
});

describe('telemetry instrument()', () => {
  // Require telemetry after setting up test state dir
  const telemetry = require('../lib/telemetry');

  before(() => {
    // Init telemetry with test socket path
    telemetry.init();
  });

  after(() => {
    telemetry.shutdown();
  });

  it('should proxy non-instrumented methods unchanged', () => {
    const obj = {
      name: 'test',
      regular() { return 42; },
      tracked() { return 'traced'; }
    };

    const proxied = telemetry.instrument(obj, ['tracked'], { type: 'test' });
    assert.equal(proxied.name, 'test');
    assert.equal(proxied.regular(), 42);
  });

  it('should instrument sync methods', () => {
    const obj = {
      missionId: 'mid-1',
      repo: 'test-repo',
      compute(x) { return x * 2; }
    };

    const proxied = telemetry.instrument(obj, ['compute'], { type: 'test' });
    const result = proxied.compute(21);
    assert.equal(result, 42);
  });

  it('should instrument async methods', async () => {
    const obj = {
      missionId: 'mid-2',
      repo: 'test-repo',
      async fetchData() { return { data: 'hello' }; }
    };

    const proxied = telemetry.instrument(obj, ['fetchData'], { type: 'test' });
    const result = await proxied.fetchData();
    assert.deepEqual(result, { data: 'hello' });
  });

  it('should propagate errors from instrumented methods', async () => {
    const obj = {
      missionId: 'mid-3',
      repo: 'test-repo',
      async failMethod() { throw new Error('test error'); }
    };

    const proxied = telemetry.instrument(obj, ['failMethod'], { type: 'test' });
    await assert.rejects(() => proxied.failMethod(), { message: 'test error' });
  });

  it('should emit lifecycle events', () => {
    const events = [];
    const unsub = telemetry.subscribe('method:before', (e) => events.push(e));

    const obj = {
      missionId: 'mid-4',
      repo: 'test-repo',
      doWork() { return 'done'; }
    };

    const proxied = telemetry.instrument(obj, ['doWork'], { type: 'test' });
    proxied.doWork();

    assert.ok(events.length >= 1);
    assert.equal(events[0].method, 'doWork');
    assert.equal(events[0].target, 'test');

    unsub();
  });
});
