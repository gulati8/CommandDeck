'use strict';

const fs = require('fs');
const path = require('path');

const STATE_DIR = process.env.COMMANDDECK_STATE_DIR || path.join(process.env.HOME, '.commanddeck');

function logEvent(event, payload = {}) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    event,
    mission_id: payload.mission_id || null,
    repo: payload.repo || null,
    objective_id: payload.objective_id || null,
    status: payload.status || null,
    message: payload.message || null
  });
  console.log(line);
}

function persistHealthAlert(repo, missionId, alert) {
  const dir = path.join(STATE_DIR, 'projects', repo, 'missions', missionId, 'artifacts');
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, 'health-alerts.ndjson');
  fs.appendFileSync(
    filePath,
    JSON.stringify({ ts: new Date().toISOString(), ...alert }) + '\n',
    'utf-8'
  );
}

module.exports = {
  logEvent,
  persistHealthAlert
};
