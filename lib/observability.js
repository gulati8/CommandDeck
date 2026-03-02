'use strict';

const db = require('./db');

function logEvent(event, payload = {}) {
  // Log to console for real-time visibility
  console.log(JSON.stringify({
    ts: new Date().toISOString(),
    event,
    mission_id: payload.mission_id || null,
    repo: payload.repo || null
  }));

  // Persist to SQLite events table
  db.logEvent(event, {
    mission_id: payload.mission_id || undefined,
    repo: payload.repo || undefined,
    actor: payload.actor || undefined,
    ...payload
  });
}

function persistHealthAlert(repo, missionId, alert) {
  db.logEvent('health.alert', {
    mission_id: missionId,
    repo,
    actor: 'health-patrol',
    ...alert
  });
}

module.exports = {
  logEvent,
  persistHealthAlert
};
