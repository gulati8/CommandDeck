'use strict';

const tdb = require('./telemetry-db');

function logEvent(event, payload = {}) {
  tdb.logEvent(event, {
    mission_id: payload.mission_id || undefined,
    repo: payload.repo || undefined,
    actor: payload.actor || undefined,
    ...payload
  });
}

function persistHealthAlert(repo, missionId, alert) {
  tdb.logEvent('health.alert', {
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
