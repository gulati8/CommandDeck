'use strict';

const fs = require('fs');
const path = require('path');

const { missionDir } = require('./state');

// Required fields in an evidence bundle
const REQUIRED_FIELDS = ['objective_id', 'agent', 'summary', 'files_changed', 'commands_run', 'tests'];

// Validate an evidence bundle against the schema
function validate(bundle) {
  const errors = [];

  for (const field of REQUIRED_FIELDS) {
    if (!(field in bundle)) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  if (bundle.files_changed) {
    for (const key of ['created', 'modified', 'deleted']) {
      if (!Array.isArray(bundle.files_changed[key])) {
        errors.push(`files_changed.${key} must be an array`);
      }
    }
  }

  if (bundle.tests) {
    if (!Array.isArray(bundle.tests.added)) {
      errors.push('tests.added must be an array');
    }
    if (!['pass', 'fail', 'skip', 'none'].includes(bundle.tests.result)) {
      errors.push('tests.result must be one of: pass, fail, skip, none');
    }
  }

  if (!Array.isArray(bundle.commands_run)) {
    errors.push('commands_run must be an array');
  }

  return { valid: errors.length === 0, errors };
}

// Read an evidence bundle for an objective
function readEvidence(repo, missionId, objectiveId) {
  const dir = missionDir(repo, missionId);
  const filePath = path.join(dir, 'artifacts', `evidence-${objectiveId}.json`);

  if (!fs.existsSync(filePath)) return null;

  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

// Read all evidence bundles for a mission
function readAllEvidence(repo, missionId) {
  const dir = path.join(missionDir(repo, missionId), 'artifacts');

  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir)
    .filter(f => f.startsWith('evidence-') && f.endsWith('.json'))
    .map(f => {
      try {
        return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8'));
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

// Format a single evidence bundle as markdown for the PR body
function formatObjectiveMarkdown(bundle, workItem) {
  const status = workItem?.status === 'done' ? '✅' : '⏳';
  const agent = bundle.agent || 'unknown';
  const title = workItem?.title || bundle.objective_id;

  let md = `### ${bundle.objective_id}: ${title} — ${status} ${agent}\n`;

  // File counts
  const created = bundle.files_changed?.created?.length || 0;
  const modified = bundle.files_changed?.modified?.length || 0;
  const deleted = bundle.files_changed?.deleted?.length || 0;
  md += `- Files: ${created} created, ${modified} modified`;
  if (deleted > 0) md += `, ${deleted} deleted`;
  md += '\n';

  // Test info
  if (bundle.tests) {
    const added = bundle.tests.added?.length || 0;
    md += `- Tests: ${added} added, ${bundle.tests.result}`;
    if (bundle.tests.coverage) md += ` (${bundle.tests.coverage} coverage)`;
    md += '\n';
  }

  // Risk flags
  if (bundle.risk_flags?.length > 0) {
    md += `- Risk flags: ⚠️ ${bundle.risk_flags.join(', ')}\n`;
  }

  // Reviewer notes
  if (bundle.notes_for_reviewer?.length > 0) {
    md += `- **Reviewer notes:**\n`;
    for (const note of bundle.notes_for_reviewer) {
      md += `  - ${note}\n`;
    }
  }

  return md;
}

// Build the full PR body from mission state and evidence bundles
function buildPRBody(mission) {
  const bundles = readAllEvidence(mission.repo, mission.mission_id);
  const workItemMap = new Map(mission.work_items.map(w => [w.id, w]));

  // Count totals
  let totalFiles = 0;
  let totalLines = 0;
  for (const b of bundles) {
    const fc = b.files_changed || {};
    totalFiles += (fc.created?.length || 0) + (fc.modified?.length || 0);
  }
  const totalSessions = mission.session_log?.length || 0;

  let body = `## 🖖 CommandDeck Mission: ${mission.description}\n\n`;
  body += `### Mission Summary\n`;
  body += `${mission.work_items.length} objectives across `;
  body += `${new Set(mission.work_items.map(w => w.phase)).size} phases. `;
  body += `${totalSessions} sessions. ${totalFiles} files.\n\n`;

  // Each objective
  for (const item of mission.work_items) {
    const bundle = bundles.find(b => b.objective_id === item.id);
    if (bundle) {
      body += formatObjectiveMarkdown(bundle, item) + '\n';
    } else {
      body += `### ${item.id}: ${item.title} — ${item.status === 'done' ? '✅' : '⏳'} ${item.assigned_to}\n`;
      body += `- No evidence bundle found\n\n`;
    }
  }

  // Full evidence JSON in collapsible section
  body += `### Evidence Bundle Details\n`;
  body += `<details><summary>Full evidence JSON</summary>\n\n`;
  body += '```json\n';
  body += JSON.stringify(bundles, null, 2);
  body += '\n```\n';
  body += `</details>\n`;

  return body;
}

module.exports = {
  REQUIRED_FIELDS,
  validate,
  readEvidence,
  readAllEvidence,
  formatObjectiveMarkdown,
  buildPRBody
};
