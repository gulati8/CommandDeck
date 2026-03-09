'use strict';

const db = require('./db');

// Create a Slack reporter that posts to a thread
function slackReporter(app, channel, threadTs) {
  return {
    post: async (text) => {
      try {
        const result = await app.client.chat.postMessage({
          channel,
          thread_ts: threadTs,
          text
        });
        return result.ts;
      } catch (err) {
        console.error('Slack post error:', err.message);
        return null;
      }
    }
  };
}

// Create a console reporter for CLI usage
function consoleReporter() {
  return {
    post: async (text) => {
      console.log(text);
      return null;
    }
  };
}

// Detect repo from Slack channel using channel map
function detectRepoFromChannel(channel) {
  return db.getRepoForChannel(channel);
}

// Reverse lookup: find which channel is mapped to a given repo
function findChannelForRepo(repo) {
  return db.getChannelForRepo(repo);
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
      'pending_approval': '🗳️'
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

// --- Proposal tracking (via SQLite) ---

function trackProposal(messageTs, proposalData) {
  db.trackProposal(messageTs, proposalData);
}

function getProposal(messageTs) {
  return db.getProposal(messageTs);
}

function removeProposal(messageTs) {
  db.removeProposal(messageTs);
}

// --- PR approval tracking (via SQLite) ---

function trackPRApproval(messageTs, approvalData) {
  db.trackApproval(messageTs, 'pr', approvalData);
}

function getPRApproval(messageTs) {
  const a = db.getApproval(messageTs);
  if (!a || a.type !== 'pr') return null;
  return a;
}

function removePRApproval(messageTs) {
  db.removeApproval(messageTs);
}

// --- Plan approval tracking (via SQLite) ---

function trackPlanApproval(messageTs, approvalData) {
  db.trackApproval(messageTs, 'plan', approvalData);
}

function getPlanApproval(messageTs) {
  const a = db.getApproval(messageTs);
  if (!a || a.type !== 'plan') return null;
  return a;
}

function removePlanApproval(messageTs) {
  db.removeApproval(messageTs);
}

module.exports = {
  slackReporter,
  consoleReporter,
  detectRepoFromChannel,
  findChannelForRepo,
  parseRepoFromPrompt,
  parseTaskFromPrompt,
  formatStatusMessage,
  formatProposalMessage,
  trackProposal,
  getProposal,
  removeProposal,
  trackPRApproval,
  getPRApproval,
  removePRApproval,
  trackPlanApproval,
  getPlanApproval,
  removePlanApproval
};
