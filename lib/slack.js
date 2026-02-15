'use strict';

const fs = require('fs');
const path = require('path');

const STATE_DIR = process.env.COMMANDDECK_STATE_DIR || path.join(process.env.HOME, '.commanddeck');
// Channel map: check state dir first (persistent across container rebuilds), then repo root
const CHANNEL_MAP_PATH = process.env.COMMANDDECK_CHANNEL_MAP
  || (fs.existsSync(path.join(STATE_DIR, 'channel-map.json'))
    ? path.join(STATE_DIR, 'channel-map.json')
    : path.join(__dirname, '..', 'channel-map.json'));
const PROPOSALS_INDEX_PATH = path.join(STATE_DIR, 'proposed', 'index.json');
const PROPOSALS_LOCK_PATH = PROPOSALS_INDEX_PATH + '.lock';

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
      'failed': '🔴',
      'checkpoint_paused': '⏸️'
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

// --- Disk-backed governance proposal tracking ---
// Persists proposal index to ~/.commanddeck/proposed/index.json
// so proposals survive Q restarts.

function readProposalIndex() {
  try {
    return JSON.parse(fs.readFileSync(PROPOSALS_INDEX_PATH, 'utf-8'));
  } catch {
    return {};
  }
}

function writeProposalIndex(index) {
  const dir = path.dirname(PROPOSALS_INDEX_PATH);
  fs.mkdirSync(dir, { recursive: true });
  const tmpPath = PROPOSALS_INDEX_PATH + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(index, null, 2) + '\n', 'utf-8');
  fs.renameSync(tmpPath, PROPOSALS_INDEX_PATH);
}

function trackProposal(messageTs, proposalData) {
  withProposalLock(() => {
    const index = readProposalIndex();
    index[messageTs] = {
      ...proposalData,
      tracked_at: new Date().toISOString()
    };
    writeProposalIndex(index);
  });
}

function getProposal(messageTs) {
  const index = readProposalIndex();
  return index[messageTs] || null;
}

function removeProposal(messageTs) {
  withProposalLock(() => {
    const index = readProposalIndex();
    delete index[messageTs];
    writeProposalIndex(index);
  });
}

function withProposalLock(fn) {
  fs.mkdirSync(path.dirname(PROPOSALS_LOCK_PATH), { recursive: true });
  const started = Date.now();
  while (Date.now() - started < 10000) {
    try {
      fs.mkdirSync(PROPOSALS_LOCK_PATH);
      try {
        return fn();
      } finally {
        fs.rmdirSync(PROPOSALS_LOCK_PATH);
      }
    } catch (err) {
      if (err.code === 'EEXIST') {
        try {
          const stat = fs.statSync(PROPOSALS_LOCK_PATH);
          if (Date.now() - stat.mtimeMs > 10000) {
            fs.rmdirSync(PROPOSALS_LOCK_PATH);
            continue;
          }
        } catch {
          continue;
        }
        continue;
      }
      throw err;
    }
  }
  throw new Error('Failed to acquire proposals index lock');
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
