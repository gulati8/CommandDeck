'use strict';

const fs = require('fs');
const path = require('path');

const STATE_DIR = process.env.COMMANDDECK_STATE_DIR || path.join(process.env.HOME, '.commanddeck');
const CHANNEL_MAP_PATH = path.join(__dirname, '..', 'channel-map.json');
const GOVERNANCE_INDEX_PATH = path.join(STATE_DIR, 'proposed', 'index.json');

// Create a Slack reporter that posts to a thread
function slackReporter(app, channel, threadTs) {
  return {
    post: async (text) => {
      try {
        await app.client.chat.postMessage({
          channel,
          thread_ts: threadTs,
          text
        });
      } catch (err) {
        console.error('Slack post error:', err.message);
      }
    }
  };
}

// Create a console reporter for CLI usage
function consoleReporter() {
  return {
    post: async (text) => {
      console.log(text);
    }
  };
}

// Detect repo from Slack channel using channel map
function detectRepoFromChannel(channel) {
  try {
    const map = JSON.parse(fs.readFileSync(CHANNEL_MAP_PATH, 'utf-8'));
    return map.channel_map?.[channel] || null;
  } catch {
    return null;
  }
}

// Parse repo from prompt: "in <repo-name> <task>"
function parseRepoFromPrompt(prompt) {
  const match = prompt.match(/^in\s+(\S+)\s/i);
  return match ? match[1] : null;
}

// Extract the task from a prompt that starts with "in <repo>"
function parseTaskFromPrompt(prompt) {
  return prompt.replace(/^in\s+\S+\s*/i, '').trim();
}

// Format a mission status summary for Slack
function formatStatusMessage(mission) {
  if (!mission) return 'No active mission found.';

  const items = mission.work_items || [];
  const done = items.filter(w => w.status === 'done').length;
  const inProgress = items.filter(w => w.status === 'in_progress').length;
  const failed = items.filter(w => w.status === 'failed').length;
  const total = items.length;

  let msg = `📊 Mission: ${mission.description}\n`;
  msg += `Status: ${mission.status}\n`;
  msg += `Progress: ${done}/${total} objectives complete`;
  if (inProgress > 0) msg += `, ${inProgress} in progress`;
  if (failed > 0) msg += `, ${failed} failed`;
  msg += '\n\n';

  for (const item of items) {
    const icon = {
      'done': '✅',
      'in_progress': '⚡',
      'ready': '⏳',
      'blocked': '🔒',
      'failed': '🔴'
    }[item.status] || '❓';

    const flags = item.risk_flags?.length ? ` ⚠️ ${item.risk_flags.join(', ')}` : '';
    msg += `${icon} ${item.id}: ${item.title} (${item.assigned_to})${flags}\n`;
  }

  if (mission.pr?.url) {
    msg += `\nPR: ${mission.pr.url}`;
  }

  return msg;
}

// Format a governance proposal for Slack
function formatProposalMessage(proposal) {
  return proposal.message;
}

// Store a mapping from Slack message ts to governance proposal data.
// Persisted to disk so process restarts don't lose pending approvals.
const governanceIndex = new Map(loadGovernanceIndex());

function trackProposal(messageTs, proposalData) {
  governanceIndex.set(messageTs, proposalData);
  saveGovernanceIndex(governanceIndex);
}

function getProposal(messageTs) {
  if (governanceIndex.has(messageTs)) return governanceIndex.get(messageTs);
  const fresh = loadGovernanceIndex();
  for (const [key, value] of fresh.entries()) {
    governanceIndex.set(key, value);
  }
  return governanceIndex.get(messageTs);
}

function removeProposal(messageTs) {
  governanceIndex.delete(messageTs);
  saveGovernanceIndex(governanceIndex);
}

function lockPath(filePath) {
  return filePath + '.lock';
}

function withLock(filePath, fn) {
  const lock = lockPath(filePath);
  const started = Date.now();
  while (Date.now() - started < 10000) {
    try {
      fs.mkdirSync(lock);
      try {
        return fn();
      } finally {
        fs.rmdirSync(lock);
      }
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
    }
  }
  throw new Error(`Could not acquire governance index lock for ${filePath}`);
}

function loadGovernanceIndex() {
  try {
    if (!fs.existsSync(GOVERNANCE_INDEX_PATH)) return [];
    const raw = fs.readFileSync(GOVERNANCE_INDEX_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveGovernanceIndex(indexMap) {
  fs.mkdirSync(path.dirname(GOVERNANCE_INDEX_PATH), { recursive: true });
  withLock(GOVERNANCE_INDEX_PATH, () => {
    const entries = Array.from(indexMap.entries());
    const tmpPath = GOVERNANCE_INDEX_PATH + '.tmp';
    fs.writeFileSync(tmpPath, JSON.stringify(entries, null, 2) + '\n', 'utf-8');
    fs.renameSync(tmpPath, GOVERNANCE_INDEX_PATH);
  });
}

module.exports = {
  slackReporter,
  consoleReporter,
  detectRepoFromChannel,
  parseRepoFromPrompt,
  parseTaskFromPrompt,
  formatStatusMessage,
  formatProposalMessage,
  trackProposal,
  getProposal,
  removeProposal
};
