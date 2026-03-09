'use strict';

const { trace, SpanStatusCode, context: otelContext } = require('@opentelemetry/api');
const { NodeTracerProvider } = require('@opentelemetry/sdk-trace-node');
const { SimpleSpanProcessor } = require('@opentelemetry/sdk-trace-base');
const { resourceFromAttributes } = require('@opentelemetry/resources');
const EventEmitter = require('events');
const net = require('net');
const path = require('path');
const fs = require('fs');
const tdb = require('./telemetry-db');

const SOCKET_PATH = process.env.COMMANDDECK_TELEMETRY_SOCKET || '/tmp/commanddeck-telemetry.sock';

let _provider = null;
let _tracer = null;
let _socketServer = null;
let _initialized = false;

// Lifecycle event bus — telemetry listener + future listeners subscribe here
const lifecycle = new EventEmitter();

// In-memory trace buffers: traceId → { spans: [], rootSpan, missionId, repo, startedAt }
const _traceBuffers = new Map();

// SSE clients: Set of response objects for live streaming
const _sseClients = new Set();

// --- OTel Custom SQLite Exporter ---

class SQLiteSpanExporter {
  export(spans, resultCallback) {
    for (const span of spans) {
      const spanContext = span.spanContext();
      const traceId = spanContext.traceId;
      const buf = _traceBuffers.get(traceId);
      if (!buf) continue;

      const spanDoc = {
        span_id: spanContext.spanId,
        parent_span_id: span.parentSpanId || null,
        name: span.name,
        status: span.status?.code === SpanStatusCode.ERROR ? 'error' : 'ok',
        start_time: new Date(Number(span.startTime[0]) * 1000 + span.startTime[1] / 1e6).toISOString(),
        end_time: new Date(Number(span.endTime[0]) * 1000 + span.endTime[1] / 1e6).toISOString(),
        duration_ms: Math.round(
          (Number(span.endTime[0]) - Number(span.startTime[0])) * 1000 +
          (span.endTime[1] - span.startTime[1]) / 1e6
        ),
        attributes: Object.fromEntries(
          Object.entries(span.attributes || {}).map(([k, v]) => [k, v])
        ),
        children: []
      };

      buf.spans.push(spanDoc);

      // If root span ended, finalize the trace
      if (buf.rootSpanId === spanContext.spanId) {
        finalizeTrace(traceId, buf, spanDoc);
      } else {
        // Snapshot in-progress trace
        snapshotTrace(traceId, buf);
      }
    }
    resultCallback({ code: 0 });
  }

  shutdown() {
    return Promise.resolve();
  }

  forceFlush() {
    return Promise.resolve();
  }
}

function buildSpanTree(spans) {
  const byId = new Map();
  for (const s of spans) byId.set(s.span_id, { ...s, children: [] });

  const roots = [];
  for (const s of byId.values()) {
    if (s.parent_span_id && byId.has(s.parent_span_id)) {
      byId.get(s.parent_span_id).children.push(s);
    } else {
      roots.push(s);
    }
  }
  return roots;
}

function finalizeTrace(traceId, buf, rootSpanDoc) {
  const tree = buildSpanTree(buf.spans);
  const endedAt = rootSpanDoc.end_time;
  const startedAt = buf.startedAt;
  const durationMs = startedAt && endedAt
    ? new Date(endedAt).getTime() - new Date(startedAt).getTime()
    : rootSpanDoc.duration_ms;

  const hasError = buf.spans.some(s => s.status === 'error');

  tdb.upsertTrace({
    trace_id: traceId,
    mission_id: buf.missionId,
    repo: buf.repo,
    status: hasError ? 'error' : 'completed',
    started_at: startedAt,
    ended_at: endedAt,
    duration_ms: durationMs,
    span_count: buf.spans.length,
    spans: tree
  });

  broadcastSSE({
    type: 'trace_completed',
    trace_id: traceId,
    mission_id: buf.missionId,
    status: hasError ? 'error' : 'completed',
    duration_ms: durationMs
  });

  _traceBuffers.delete(traceId);
}

function snapshotTrace(traceId, buf) {
  const tree = buildSpanTree(buf.spans);
  tdb.upsertTrace({
    trace_id: traceId,
    mission_id: buf.missionId,
    repo: buf.repo,
    status: 'in_progress',
    started_at: buf.startedAt,
    span_count: buf.spans.length,
    spans: tree
  });
}

// --- SSE Broadcasting ---

function broadcastSSE(data) {
  const msg = `data: ${JSON.stringify(data)}\n\n`;
  for (const client of _sseClients) {
    try {
      client.write(msg);
    } catch {
      _sseClients.delete(client);
    }
  }
}

function addSSEClient(res) {
  _sseClients.add(res);
  res.on('close', () => _sseClients.delete(res));
}

// --- Init ---

function init() {
  if (_initialized) return;

  const resource = resourceFromAttributes({ 'service.name': 'commanddeck' });
  _provider = new NodeTracerProvider({
    resource,
    spanProcessors: [new SimpleSpanProcessor(new SQLiteSpanExporter())]
  });
  _provider.register();
  _tracer = trace.getTracer('commanddeck');
  _initialized = true;

  // Start Unix socket listener for hook data
  startSocketServer();

  // Initialize telemetry DB
  tdb.getDb();
}

function shutdown() {
  if (_socketServer) {
    _socketServer.close();
    _socketServer = null;
  }
  if (_provider) {
    _provider.shutdown();
    _provider = null;
  }
  _initialized = false;
  for (const client of _sseClients) {
    try { client.end(); } catch { /* ignore */ }
  }
  _sseClients.clear();
}

// --- Unix Socket Server (receives hook data from workers) ---

function startSocketServer() {
  // Clean up stale socket
  try { fs.unlinkSync(SOCKET_PATH); } catch { /* ok */ }

  _socketServer = net.createServer((conn) => {
    let buffer = '';
    conn.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep incomplete line
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const data = JSON.parse(line);
          handleHookData(data);
        } catch {
          // Ignore malformed lines
        }
      }
    });
  });

  _socketServer.on('error', (err) => {
    if (err.code !== 'EADDRINUSE') {
      console.error('Telemetry socket error:', err.message);
    }
  });

  _socketServer.listen(SOCKET_PATH, () => {
    // Make socket accessible
    try { fs.chmodSync(SOCKET_PATH, 0o666); } catch { /* ok */ }
  });
}

function handleHookData(data) {
  // Data from PostToolUse hook: { tool, input, output, mission_id, trace_id, span_id, agent, objective_id, repo }
  const logEntry = {
    ts: new Date().toISOString(),
    trace_id: data.trace_id || null,
    span_id: data.span_id || null,
    mission_id: data.mission_id || null,
    repo: data.repo || null,
    source: 'hook',
    agent: data.agent || null,
    objective_id: data.objective_id || null,
    level: 'info',
    message: `tool: ${data.tool || 'unknown'}`,
    data: {
      tool: data.tool,
      input: truncate(data.input, 500),
      output: truncate(data.output, 1000)
    }
  };

  tdb.writeLog(logEntry);

  broadcastSSE({
    type: 'log',
    ...logEntry
  });

  lifecycle.emit('hook_data', data);
}

function truncate(str, max) {
  if (!str || typeof str !== 'string') return str;
  if (str.length <= max) return str;
  return str.substring(0, max) + '...';
}

// --- Tracer Access ---

function getTracer(name) {
  if (!_initialized) init();
  return name ? trace.getTracer(name) : _tracer;
}

// --- Proxy-based Instrumentation ---

function instrument(target, methods, metadata = {}) {
  if (!_initialized) init();

  return new Proxy(target, {
    get(obj, prop) {
      const original = obj[prop];

      if (typeof original !== 'function' || !methods.includes(prop)) {
        return original;
      }

      return function instrumentedMethod(...args) {
        const tracer = getTracer();
        const spanName = metadata.prefix ? `${metadata.prefix}.${prop}` : prop;

        // Determine if this is a root span (mission.start)
        const isRoot = prop === 'start' && metadata.type === 'mission';

        return tracer.startActiveSpan(spanName, (span) => {
          const spanContext = span.spanContext();
          const traceId = spanContext.traceId;

          // Initialize trace buffer for root spans
          if (isRoot || !_traceBuffers.has(traceId)) {
            _traceBuffers.set(traceId, {
              spans: [],
              rootSpanId: isRoot ? spanContext.spanId : null,
              missionId: metadata.missionId || obj.missionId || null,
              repo: metadata.repo || obj.repo || null,
              startedAt: new Date().toISOString()
            });
          }

          // Update buffer metadata as it becomes available
          const buf = _traceBuffers.get(traceId);
          if (isRoot) buf.rootSpanId = spanContext.spanId;
          if (obj.missionId && !buf.missionId) buf.missionId = obj.missionId;
          if (obj.repo && !buf.repo) buf.repo = obj.repo;

          // Set span attributes
          span.setAttribute('method', prop);
          if (obj.missionId) span.setAttribute('mission_id', obj.missionId);
          if (obj.repo) span.setAttribute('repo', obj.repo);

          // Apply method-specific attributes
          if (metadata.attributeExtractors?.[prop]) {
            const attrs = metadata.attributeExtractors[prop](args, obj);
            for (const [k, v] of Object.entries(attrs)) {
              if (v != null) span.setAttribute(k, String(v));
            }
          }

          // Emit lifecycle event
          lifecycle.emit('method:before', {
            method: prop,
            target: metadata.type || 'unknown',
            traceId,
            spanId: spanContext.spanId,
            missionId: obj.missionId,
            repo: obj.repo,
            args
          });

          // Write log entry for method start
          tdb.writeLog({
            ts: new Date().toISOString(),
            trace_id: traceId,
            span_id: spanContext.spanId,
            mission_id: obj.missionId || metadata.missionId,
            repo: obj.repo || metadata.repo,
            source: 'system',
            level: 'info',
            message: `${spanName} started`
          });

          broadcastSSE({
            type: 'span_start',
            trace_id: traceId,
            span_id: spanContext.spanId,
            name: spanName,
            mission_id: obj.missionId,
            repo: obj.repo
          });

          let result;
          try {
            result = original.apply(obj, args);
          } catch (err) {
            span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
            span.recordException(err);
            span.end();

            lifecycle.emit('method:error', {
              method: prop, target: metadata.type, error: err,
              traceId, spanId: spanContext.spanId
            });

            throw err;
          }

          // Handle async methods
          if (result && typeof result.then === 'function') {
            return result.then(
              (val) => {
                span.setStatus({ code: SpanStatusCode.OK });
                span.end();

                lifecycle.emit('method:after', {
                  method: prop, target: metadata.type, result: val,
                  traceId, spanId: spanContext.spanId
                });

                return val;
              },
              (err) => {
                span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
                span.recordException(err);
                span.end();

                lifecycle.emit('method:error', {
                  method: prop, target: metadata.type, error: err,
                  traceId, spanId: spanContext.spanId
                });

                throw err;
              }
            );
          }

          // Sync method
          span.setStatus({ code: SpanStatusCode.OK });
          span.end();

          lifecycle.emit('method:after', {
            method: prop, target: metadata.type, result,
            traceId, spanId: spanContext.spanId
          });

          return result;
        });
      };
    }
  });
}

// --- Lifecycle Event Subscriptions ---

function subscribe(event, listener) {
  lifecycle.on(event, listener);
  return () => lifecycle.off(event, listener);
}

module.exports = {
  init,
  shutdown,
  getTracer,
  instrument,
  subscribe,
  addSSEClient,
  broadcastSSE,
  lifecycle,
  get initialized() { return _initialized; }
};
