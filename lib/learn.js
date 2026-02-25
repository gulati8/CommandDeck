'use strict';

const fs = require('fs');
const path = require('path');

const { STATE_DIR } = require('./state');

// Scope types for learning
const SCOPES = {
  STANDARD: 'standard',
  CREW: 'crew',
  PLAYBOOK: 'playbook',
  DIRECTIVE: 'directive'
};

// Detect the scope from the learning text
function detectScope(text) {
  const lower = text.toLowerCase();

  // Agent-specific patterns: "Spock should...", "Borg should...", "tell scotty to..."
  const agentNames = [
    'captain-picard', 'picard', 'borg', 'scotty', 'worf',
    'spock', 'geordi', 'mr-data', 'data', 'obrien', "o'brien"
  ];
  for (const agent of agentNames) {
    if (lower.includes(agent)) {
      const normalized = normalizeAgentName(agent);
      return { scope: SCOPES.CREW, agent: normalized };
    }
  }

  // Project-specific: check "in this project" before the regex to avoid capturing "this" as repo
  if (lower.includes('in this project') || lower.includes('for this project')) {
    return { scope: SCOPES.DIRECTIVE, repo: null }; // Needs repo from context
  }
  const projectMatch = lower.match(/^in\s+(\S+?)[,:\s]/);
  if (projectMatch) {
    return { scope: SCOPES.DIRECTIVE, repo: projectMatch[1] };
  }

  // Playbook patterns
  if (lower.includes('playbook') || lower.includes('template') || lower.includes('standard approach')) {
    return { scope: SCOPES.PLAYBOOK };
  }

  // Default: global standard
  return { scope: SCOPES.STANDARD };
}

// Normalize agent name variations to canonical form
function normalizeAgentName(name) {
  const map = {
    'picard': 'captain-picard',
    'captain-picard': 'captain-picard',
    'data': 'mr-data',
    'mr-data': 'mr-data',
    'obrien': 'obrien',
    "o'brien": 'obrien'
  };
  return map[name.toLowerCase()] || name.toLowerCase();
}

// Slugify text for filenames
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

// Propose a new learning (writes to proposed/ for governance, or directly for directives)
async function propose(text, context = {}) {
  const { scope, agent, repo: detectedRepo } = detectScope(text);
  const repo = detectedRepo || context.repo;
  const slug = slugify(text);
  const timestamp = new Date().toISOString();

  const content = [
    `# ${text}`,
    '',
    `Proposed: ${timestamp}`,
    `Source: ${context.channel ? 'Slack' : 'CLI'}`,
    '',
    text
  ].join('\n');

  // Project directives skip governance — write directly
  if (scope === SCOPES.DIRECTIVE) {
    if (!repo) {
      return {
        success: false,
        message: 'Project directive needs a repo. Use: "in <repo-name>, <learning>"'
      };
    }

    const dirPath = path.join(STATE_DIR, 'projects', repo, 'directives', `${slug}.md`);
    fs.mkdirSync(path.dirname(dirPath), { recursive: true });
    fs.writeFileSync(dirPath, content, 'utf-8');

    return {
      success: true,
      scope,
      repo,
      path: dirPath,
      message: `Directive saved for ${repo}: "${text}"`
    };
  }

  // Everything else goes through governance
  let proposedDir;
  let targetDir;
  let fileName;

  switch (scope) {
    case SCOPES.STANDARD:
      proposedDir = path.join(STATE_DIR, 'proposed', 'standards');
      targetDir = path.join(STATE_DIR, 'standards');
      fileName = `${slug}.md`;
      break;
    case SCOPES.CREW:
      proposedDir = path.join(STATE_DIR, 'proposed', 'crew');
      targetDir = path.join(STATE_DIR, 'crew');
      fileName = `${agent}-preferences-${slug}.md`;
      break;
    case SCOPES.PLAYBOOK:
      proposedDir = path.join(STATE_DIR, 'proposed', 'playbooks');
      targetDir = path.join(STATE_DIR, 'playbooks');
      fileName = `${slug}.md`;
      break;
    default:
      proposedDir = path.join(STATE_DIR, 'proposed', 'standards');
      targetDir = path.join(STATE_DIR, 'standards');
      fileName = `${slug}.md`;
  }

  fs.mkdirSync(proposedDir, { recursive: true });
  const proposedPath = path.join(proposedDir, fileName);
  fs.writeFileSync(proposedPath, content, 'utf-8');

  return {
    success: true,
    scope,
    agent: agent || null,
    proposedPath,
    targetDir,
    fileName,
    message: buildProposalMessage(scope, text, agent),
    needsApproval: true
  };
}

// Build the Slack/CLI message for a governance proposal
function buildProposalMessage(scope, text, agent) {
  const typeLabel = {
    [SCOPES.STANDARD]: 'Global standard',
    [SCOPES.CREW]: `Crew preference (${agent})`,
    [SCOPES.PLAYBOOK]: 'Playbook'
  }[scope] || 'Global standard';

  const impactLabel = {
    [SCOPES.STANDARD]: 'This will affect all future missions across all projects.',
    [SCOPES.CREW]: `This will affect ${agent}'s behavior in all future missions.`,
    [SCOPES.PLAYBOOK]: 'This will be available as a template for future missions.'
  }[scope] || '';

  return [
    `📝 New learning proposed:`,
    ``,
    `  **Type:** ${typeLabel}`,
    `  **Content:** "${text}"`,
    ``,
    `  ${impactLabel}`,
    ``,
    `  React ✅ to approve or ❌ to reject.`
  ].join('\n');
}

// Approve a proposed learning (move from proposed/ to active directory)
function approve(proposedPath, targetDir, fileName) {
  if (!isSafeProposalPath(proposedPath)) {
    return { success: false, message: 'Invalid proposed path' };
  }
  if (!fs.existsSync(proposedPath)) {
    return { success: false, message: 'Proposed learning not found' };
  }

  fs.mkdirSync(targetDir, { recursive: true });
  const targetPath = path.join(targetDir, fileName);

  // For crew preferences, append to existing preferences file if it exists
  if (targetDir.includes('/crew/') && fileName.includes('-preferences-')) {
    const agentMatch = fileName.match(/^(\S+)-preferences-/);
    if (agentMatch) {
      const mainPrefsFile = path.join(targetDir, `${agentMatch[1]}-preferences.md`);
      const content = fs.readFileSync(proposedPath, 'utf-8');
      if (fs.existsSync(mainPrefsFile)) {
        fs.appendFileSync(mainPrefsFile, '\n\n' + content, 'utf-8');
      } else {
        fs.copyFileSync(proposedPath, mainPrefsFile);
      }
      fs.unlinkSync(proposedPath);
      return { success: true, path: mainPrefsFile, message: 'Learning approved and applied.' };
    }
  }

  fs.renameSync(proposedPath, targetPath);
  return { success: true, path: targetPath, message: 'Learning approved and applied.' };
}

// Reject a proposed learning (delete from proposed/)
function reject(proposedPath) {
  if (!isSafeProposalPath(proposedPath)) {
    return { success: false, message: 'Invalid proposed path' };
  }
  if (!fs.existsSync(proposedPath)) {
    return { success: false, message: 'Proposed learning not found' };
  }

  fs.unlinkSync(proposedPath);
  return { success: true, message: 'Learning rejected and removed.' };
}

// Handle a Slack reaction event for governance
async function handleReaction(event) {
  // This will be wired up in q.js — the event contains the message ts,
  // which we map to a proposed learning path stored in a governance index.
  // For now, return the reaction type for the caller to handle.
  const reaction = event.reaction;

  if (reaction === 'white_check_mark' || reaction === '+1') {
    return { action: 'approve' };
  }
  if (reaction === 'x' || reaction === '-1') {
    return { action: 'reject' };
  }

  return { action: 'ignore' };
}

// List all pending proposals
function listPending() {
  const proposedDir = path.join(STATE_DIR, 'proposed');
  if (!fs.existsSync(proposedDir)) return [];

  const pending = [];

  for (const subdir of ['standards', 'crew', 'playbooks']) {
    const dir = path.join(proposedDir, subdir);
    if (!fs.existsSync(dir)) continue;

    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith('.md')) continue;
      pending.push({
        scope: subdir.replace(/s$/, ''), // standards → standard
        path: path.join(dir, file),
        name: file
      });
    }
  }

  return pending;
}

function isSafeProposalPath(proposedPath) {
  const resolved = path.resolve(proposedPath);
  const root = path.resolve(path.join(STATE_DIR, 'proposed'));
  return resolved.startsWith(root + path.sep);
}

module.exports = {
  SCOPES,
  detectScope,
  propose,
  approve,
  reject,
  handleReaction,
  listPending
};
