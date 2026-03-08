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
        // Reset to previous logical state
        const resetTo = index[key].mission_id ? 'idle' : 'conversing';
        index[key].status = resetTo;
        index[key].updated_at = new Date().toISOString();
        changed = true;
      }
      if (index[key].status === 'launching') {
        index[key].status = 'conversing';
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

// --- Unified Message Classification ---

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

// Classify any incoming message — works for both pre-mission and post-mission threads
async function classifyMessage(app, channel, threadTs, messages, context) {
  const threadHistory = threadTs
    ? await fetchThreadHistory(app, channel, threadTs)
    : '';
  const latestMessage = Array.isArray(messages) ? messages.join('\n') : messages;

  const contextLines = [];
  if (context.repo) contextLines.push(`Project: ${context.repo}`);
  if (context.original_description) {
    contextLines.push(`Original task: "${context.original_description}"`);
  }
  if (context.pr_url) contextLines.push(`Active PR: ${context.pr_url}`);
  if (context.mission_id) contextLines.push(`Mission: ${context.mission_id}`);

  const prompt = [
    'You are Captain Picard assessing a message to CommandDeck.',
    '',
    contextLines.length ? contextLines.join('\n') : 'No prior context.',
    '',
    threadHistory ? `Conversation so far:\n${threadHistory}\n` : '',
    'Latest message:',
    latestMessage,
    '',
    'Classify this message and respond with ONLY a JSON object (no surrounding text):',
    '{',
    '  "action": "work" | "converse" | "inquiry",',
    '  "message": "Your conversational response to the user",',
    '  "task_description": "If action is work, the clear actionable task to execute"',
    '}',
    '',
    'Guidelines:',
    '- "work": The message clearly describes a specific, actionable development task.',
    '  Examples: "Add OAuth2 login with Google", "Fix the 500 error on /api/users",',
    '  "Change the button color to blue", "Upgrade React to v19"',
    '- "converse": The message is exploratory, vague, or would benefit from discussion.',
    '  Examples: "I\'m thinking about adding auth", "The app feels slow",',
    '  "What should we build next?", "I have some feedback on the PR"',
    '- "inquiry": Asking about status, capabilities, or information — no code change needed.',
    '  Examples: "What\'s the current test coverage?", "How does the auth system work?",',
    '  "Thanks, looks good!", "What did you change?"',
    '- Default to "converse" when the request is ambiguous or could mean several things.',
    '- Only use "work" when you have enough specificity to act on immediately.',
    '- Be conversational and helpful in your message.',
    '- For "converse", ask questions that help crystallize the idea into something actionable.',
    '- For "work", rewrite the task as a clear, complete task_description.',
  ].join('\n');

  try {
    const result = await worker.executeTriage(prompt);
    return parseClassification(result.stdout);
  } catch (err) {
    console.error('Classification failed:', err.message);
    return {
      action: 'converse',
      message: "I'd like to help — could you tell me more about what you have in mind?",
      task_description: null
    };
  }
}

// Parse classification JSON response
function parseClassification(stdout) {
  if (!stdout || !stdout.trim()) {
    return {
      action: 'converse',
      message: "I'd like to help — could you tell me more about what you have in mind?",
      task_description: null
    };
  }

  try {
    const parsed = JSON.parse(stdout.trim());
    return validateClassification(parsed);
  } catch {
    const jsonMatch = stdout.match(/\{[\s\S]*"action"\s*:\s*"[^"]+[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return validateClassification(JSON.parse(jsonMatch[0]));
      } catch {
        // Fall through
      }
    }
  }

  return {
    action: 'converse',
    message: "I'd like to help — could you tell me more about what you have in mind?",
    task_description: null
  };
}

function validateClassification(parsed) {
  const validActions = ['work', 'converse', 'inquiry'];
  if (!parsed.action || !validActions.includes(parsed.action)) {
    return {
      action: 'converse',
      message: parsed.message || "Could you tell me more about what you have in mind?",
      task_description: null
    };
  }

  return {
    action: parsed.action,
    message: parsed.message || '',
    task_description: parsed.task_description || null
  };
}

// --- Response Routing ---

// Unified handler for classified messages — routes based on thread context
async function handleClassification(app, threadContext, classification) {
  const reporter = slack.slackReporter(app, threadContext.channel, threadContext.thread_ts);
  const hasMission = !!threadContext.mission_id;

  logEvent('thread.classification', {
    channel: threadContext.channel,
    thread_ts: threadContext.thread_ts,
    action: classification.action,
    repo: threadContext.repo,
    has_mission: hasMission
  });

  // Conversational or informational — respond and stay in current state
  if (classification.action === 'converse' || classification.action === 'inquiry') {
    await reporter.post(classification.message);
    const idleStatus = hasMission ? 'idle' : 'conversing';
    updateThreadStatus(threadContext.channel, threadContext.thread_ts, idleStatus);
    return { action: classification.action };
  }

  // Work requested — route depends on whether a mission already exists
  if (classification.action === 'work') {
    if (!hasMission) {
      // Pre-mission: signal back to caller to launch a new mission
      await reporter.post(classification.message || 'Understood — launching mission.');
      updateThreadStatus(threadContext.channel, threadContext.thread_ts, 'launching');
      return {
        action: 'work',
        task_description: classification.task_description,
        repo: threadContext.repo,
        needs_new_mission: true
      };
    }

    // Post-mission: follow-up work on existing PR
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
      return { action: 'work', pr_closed: true };
    }

    await reporter.post(
      `${classification.message}\n\nStarting follow-up work...`
    );
    updateThreadStatus(threadContext.channel, threadContext.thread_ts, 'working');
    incrementFollowUp(threadContext.channel, threadContext.thread_ts);

    try {
      const { Mission } = require('./mission');
      const result = await Mission.followUp({
        repo: threadContext.repo,
        parentMissionId: threadContext.mission_id,
        integrationBranch: threadContext.integration_branch,
        prNumber: threadContext.pr_number,
        prUrl: threadContext.pr_url,
        originalDescription: threadContext.original_description,
        prompt: classification.task_description,
        context: {
          channel: threadContext.channel,
          threadTs: threadContext.thread_ts,
          reporter,
          slackApp: app
        }
      });

      if (result.status === 'pending_approval' && result.plan_message_ts) {
        slack.trackPlanApproval(result.plan_message_ts, {
          repo: threadContext.repo,
          mission_id: result.mission_id,
          channel: threadContext.channel,
          thread_ts: threadContext.thread_ts
        });
        updateThreadStatus(threadContext.channel, threadContext.thread_ts, 'pending_plan_approval');
        return { action: 'work' };
      }

      await reporter.post(
        `Follow-up complete! The PR has been updated.\n${threadContext.pr_url}`
      );
    } catch (err) {
      await reporter.post(`Follow-up work failed: ${err.message}`);
    }

    updateThreadStatus(threadContext.channel, threadContext.thread_ts, 'idle');
    return { action: 'work' };
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
  classifyMessage,
  parseClassification,
  handleClassification,
  // Exposed for testing
  _debounceTimers,
  _debounceMessages
};
