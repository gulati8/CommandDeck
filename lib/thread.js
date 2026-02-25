'use strict';

const fs = require('fs');
const path = require('path');

const worker = require('./worker');
const pr = require('./pr');
const slack = require('./slack');
const { logEvent } = require('./observability');

const STATE_DIR = process.env.COMMANDDECK_STATE_DIR || path.join(process.env.HOME, '.commanddeck');
const THREADS_PATH = path.join(STATE_DIR, 'active-threads.json');
const THREADS_LOCK_PATH = THREADS_PATH + '.lock';

const DEBOUNCE_MS = 4000;

// In-memory debounce timers keyed by "channel:thread_ts"
const _debounceTimers = new Map();
const _debounceMessages = new Map();

// --- Disk-backed thread tracking ---

function readThreads() {
  try {
    return JSON.parse(fs.readFileSync(THREADS_PATH, 'utf-8'));
  } catch {
    return {};
  }
}

function writeThreads(index) {
  const dir = path.dirname(THREADS_PATH);
  fs.mkdirSync(dir, { recursive: true });
  const tmpPath = THREADS_PATH + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(index, null, 2) + '\n', 'utf-8');
  fs.renameSync(tmpPath, THREADS_PATH);
}

function withThreadLock(fn) {
  fs.mkdirSync(path.dirname(THREADS_LOCK_PATH), { recursive: true });
  const started = Date.now();
  while (Date.now() - started < 10000) {
    try {
      fs.mkdirSync(THREADS_LOCK_PATH);
      try {
        return fn();
      } finally {
        fs.rmdirSync(THREADS_LOCK_PATH);
      }
    } catch (err) {
      if (err.code === 'EEXIST') {
        try {
          const stat = fs.statSync(THREADS_LOCK_PATH);
          if (Date.now() - stat.mtimeMs > 10000) {
            fs.rmdirSync(THREADS_LOCK_PATH);
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
  throw new Error('Failed to acquire active-threads lock');
}

function threadKey(channel, threadTs) {
  return `${channel}:${threadTs}`;
}

// Register a thread for conversational tracking after mission creates a PR
function trackThread(channel, threadTs, context) {
  withThreadLock(() => {
    const index = readThreads();
    index[threadKey(channel, threadTs)] = {
      channel,
      thread_ts: threadTs,
      repo: context.repo,
      mission_id: context.mission_id,
      integration_branch: context.integration_branch,
      pr_number: context.pr_number,
      pr_url: context.pr_url,
      original_description: context.original_description,
      status: context.status || 'idle',
      follow_up_count: 0,
      tracked_at: new Date().toISOString()
    };
    writeThreads(index);
  });
}

// Look up thread context (null if untracked)
function getThread(channel, threadTs) {
  const index = readThreads();
  return index[threadKey(channel, threadTs)] || null;
}

// Atomic status transition
function updateThreadStatus(channel, threadTs, status) {
  withThreadLock(() => {
    const index = readThreads();
    const key = threadKey(channel, threadTs);
    if (index[key]) {
      index[key].status = status;
      index[key].updated_at = new Date().toISOString();
      writeThreads(index);
    }
  });
}

// Increment follow-up count
function incrementFollowUp(channel, threadTs) {
  withThreadLock(() => {
    const index = readThreads();
    const key = threadKey(channel, threadTs);
    if (index[key]) {
      index[key].follow_up_count = (index[key].follow_up_count || 0) + 1;
      writeThreads(index);
    }
  });
}

// Untrack when PR merged/closed
function removeThread(channel, threadTs) {
  withThreadLock(() => {
    const index = readThreads();
    delete index[threadKey(channel, threadTs)];
    writeThreads(index);
  });
}

// Reset stale assessing threads to idle (for startup recovery)
function resetStaleThreads() {
  withThreadLock(() => {
    const index = readThreads();
    let changed = false;
    for (const key of Object.keys(index)) {
      if (index[key].status === 'assessing') {
        index[key].status = 'idle';
        index[key].updated_at = new Date().toISOString();
        changed = true;
      }
    }
    if (changed) writeThreads(index);
  });
}

// --- Debounce ---

function debounce(channel, threadTs, message, callback) {
  const key = threadKey(channel, threadTs);

  // Accumulate messages
  if (!_debounceMessages.has(key)) {
    _debounceMessages.set(key, []);
  }
  _debounceMessages.get(key).push(message);

  // Clear existing timer
  if (_debounceTimers.has(key)) {
    clearTimeout(_debounceTimers.get(key));
  }

  // Set new timer
  const timer = setTimeout(() => {
    const messages = _debounceMessages.get(key) || [];
    _debounceMessages.delete(key);
    _debounceTimers.delete(key);
    callback(messages);
  }, DEBOUNCE_MS);

  _debounceTimers.set(key, timer);
}

// --- Picard Assessment ---

// Fetch thread conversation history from Slack
async function fetchThreadHistory(app, channel, threadTs) {
  try {
    const result = await app.client.conversations.replies({
      channel,
      ts: threadTs,
      limit: 50
    });

    if (!result.ok || !result.messages) return '';

    return result.messages
      .map(msg => {
        const who = msg.bot_id ? 'CommandDeck' : 'User';
        return `[${who}]: ${msg.text}`;
      })
      .join('\n');
  } catch (err) {
    console.error('Failed to fetch thread history:', err.message);
    return '';
  }
}

// Build objectives summary from mission state
function buildObjectivesSummary(missionState) {
  if (!missionState?.work_items?.length) return 'No objectives completed.';

  return missionState.work_items
    .filter(w => w.status === 'done')
    .map(w => `- ${w.id}: ${w.title} (${w.assigned_to})`)
    .join('\n');
}

// Call Picard via claude -p to assess user feedback
async function assessFeedback(app, threadContext, messages) {
  const threadHistory = await fetchThreadHistory(app, threadContext.channel, threadContext.thread_ts);
  const latestFeedback = messages.join('\n');

  const prompt = [
    'You are Captain Picard assessing user feedback in a Slack thread.',
    '',
    `Original task: "${threadContext.original_description}"`,
    '',
    'Thread conversation history:',
    threadHistory,
    '',
    'Latest user feedback:',
    latestFeedback,
    '',
    'Assess the feedback and respond with ONLY a JSON object (no surrounding text):',
    '{',
    '  "action": "clarify" | "work" | "acknowledge",',
    '  "message": "Your conversational response to the user",',
    '  "work_description": "If action is work, describe what needs to be done"',
    '}',
    '',
    'Guidelines:',
    '- "clarify": The feedback is vague or ambiguous. Ask a specific question.',
    '- "work": The feedback clearly describes a code change, bug fix, or feature request.',
    '- "acknowledge": The feedback is a thank you, status check, or requires no code change.',
    '- When in doubt, prefer "clarify" over "work".',
    '- Be conversational and friendly in your message.',
    '- For "work", write a clear work_description that a developer agent can act on.',
  ].join('\n');

  const worktreeLib = require('./worktree');
  const projectDir = worktreeLib.projectPath(threadContext.repo);

  // Build a minimal mission-like object for executeSpecialist
  const missionStub = {
    repo: threadContext.repo,
    mission_id: threadContext.mission_id
  };

  try {
    const result = await worker.executeSpecialist(
      projectDir, 'captain-picard', prompt, missionStub
    );

    return parseAssessment(result.stdout);
  } catch (err) {
    console.error('Picard assessment failed:', err.message);
    return {
      action: 'acknowledge',
      message: "I had trouble processing that. Could you rephrase your feedback?",
      work_description: null
    };
  }
}

// Parse Picard's JSON assessment from stdout, with graceful fallback
function parseAssessment(stdout) {
  if (!stdout || !stdout.trim()) {
    return {
      action: 'acknowledge',
      message: "I had trouble processing that. Could you rephrase your feedback?",
      work_description: null
    };
  }

  // Try direct parse first
  try {
    const parsed = JSON.parse(stdout.trim());
    return validateAssessment(parsed);
  } catch {
    // Try to extract JSON from surrounding text
    const jsonMatch = stdout.match(/\{[\s\S]*"action"\s*:\s*"[^"]+[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return validateAssessment(parsed);
      } catch {
        // Fall through to fallback
      }
    }
  }

  return {
    action: 'acknowledge',
    message: "I had trouble processing that. Could you rephrase your feedback?",
    work_description: null
  };
}

// Validate assessment has required fields
function validateAssessment(parsed) {
  const validActions = ['clarify', 'work', 'acknowledge'];
  if (!parsed.action || !validActions.includes(parsed.action)) {
    return {
      action: 'acknowledge',
      message: parsed.message || "I had trouble processing that. Could you rephrase your feedback?",
      work_description: null
    };
  }

  return {
    action: parsed.action,
    message: parsed.message || '',
    work_description: parsed.work_description || null
  };
}

// --- Response Routing ---

// Route the assessment: post a message, launch follow-up work, or acknowledge
async function handleAssessment(app, threadContext, assessment) {
  const reporter = slack.slackReporter(app, threadContext.channel, threadContext.thread_ts);

  logEvent('thread.assessment', {
    channel: threadContext.channel,
    thread_ts: threadContext.thread_ts,
    action: assessment.action,
    repo: threadContext.repo
  });

  if (assessment.action === 'clarify' || assessment.action === 'acknowledge') {
    await reporter.post(assessment.message);
    updateThreadStatus(threadContext.channel, threadContext.thread_ts, 'idle');
    return;
  }

  if (assessment.action === 'work') {
    // Check PR is still open before launching work
    const missionStub = {
      repo: threadContext.repo,
      pr: { number: threadContext.pr_number }
    };
    const prStatus = pr.checkStatus(missionStub);
    if (prStatus === 'merged' || prStatus === 'closed') {
      await reporter.post(
        `The PR has already been ${prStatus}. Start a new mission for further changes.`
      );
      removeThread(threadContext.channel, threadContext.thread_ts);
      return;
    }

    await reporter.post(
      `${assessment.message}\n\nStarting follow-up work...`
    );
    updateThreadStatus(threadContext.channel, threadContext.thread_ts, 'working');
    incrementFollowUp(threadContext.channel, threadContext.thread_ts);

    // Launch follow-up mission (imported lazily to avoid circular dep)
    try {
      const { Mission } = require('./mission');
      const result = await Mission.followUp({
        repo: threadContext.repo,
        parentMissionId: threadContext.mission_id,
        integrationBranch: threadContext.integration_branch,
        prNumber: threadContext.pr_number,
        prUrl: threadContext.pr_url,
        originalDescription: threadContext.original_description,
        prompt: assessment.work_description,
        context: {
          channel: threadContext.channel,
          threadTs: threadContext.thread_ts,
          reporter,
          slackApp: app
        }
      });

      await reporter.post(
        `Follow-up complete! The PR has been updated.\n${threadContext.pr_url}`
      );
    } catch (err) {
      await reporter.post(`Follow-up work failed: ${err.message}`);
    }

    updateThreadStatus(threadContext.channel, threadContext.thread_ts, 'idle');
  }
}

module.exports = {
  trackThread,
  getThread,
  updateThreadStatus,
  incrementFollowUp,
  removeThread,
  resetStaleThreads,
  debounce,
  fetchThreadHistory,
  buildObjectivesSummary,
  assessFeedback,
  parseAssessment,
  handleAssessment,
  // Exposed for testing
  _debounceTimers,
  _debounceMessages
};
