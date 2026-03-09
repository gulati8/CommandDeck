'use strict';

const worker = require('./worker');
const pr = require('./pr');
const slack = require('./slack');
const db = require('./db');

const DEBOUNCE_MS = 4000;

// In-memory debounce timers keyed by "channel:thread_ts"
const _debounceTimers = new Map();
const _debounceMessages = new Map();

// --- Thread tracking (via SQLite) ---

function trackThread(channel, threadTs, context) {
  db.trackThread(channel, threadTs, {
    repo: context.repo,
    mission_id: context.mission_id,
    integration_branch: context.integration_branch,
    pr_number: context.pr_number,
    pr_url: context.pr_url,
    original_description: context.original_description,
    status: context.status || 'idle',
    follow_up_count: context.follow_up_count || 0
  });
}

function getThread(channel, threadTs) {
  return db.getThread(channel, threadTs);
}

function updateThreadStatus(channel, threadTs, status) {
  db.updateThreadStatus(channel, threadTs, status);
}

function incrementFollowUp(channel, threadTs) {
  db.incrementFollowUp(channel, threadTs);
}

function removeThread(channel, threadTs) {
  db.removeThread(channel, threadTs);
}

function resetStaleThreads() {
  db.resetStaleThreads();
}

// --- Debounce ---

function threadKey(channel, threadTs) {
  return `${channel}:${threadTs}`;
}

function debounce(channel, threadTs, message, callback) {
  const key = threadKey(channel, threadTs);

  if (!_debounceMessages.has(key)) {
    _debounceMessages.set(key, []);
  }
  _debounceMessages.get(key).push(message);

  if (_debounceTimers.has(key)) {
    clearTimeout(_debounceTimers.get(key));
  }

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
    '  "action": "work" | "converse" | "inquiry" | "onboard" | "create",',
    '  "message": "Your conversational response to the user",',
    '  "task_description": "If action is work, the clear actionable task to execute",',
    '  "project_name": "If action is onboard or create, the project/repo name"',
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
    '- "onboard": The user wants to onboard/connect an EXISTING GitHub repo to CommandDeck.',
    '  You MUST include "project_name" with just the bare repo name.',
    '  If the conversation has established a project name earlier, use it.',
    '  If you cannot determine the project name, use "converse" instead and ask.',
    '  Examples: "onboard eastvillageeverything" → project_name: "eastvillageeverything"',
    '- "create": The user wants to create a BRAND NEW project from scratch.',
    '  You MUST include "project_name". If no name is given, use "converse" and ask.',
    '  Examples: "create a new project called myapp" → project_name: "myapp",',
    '  "new project: task-tracker" → project_name: "task-tracker"',
    '- Default to "converse" when the request is ambiguous or could mean several things.',
    '- Only use "work" when you have enough specificity to act on immediately.',
    '- Be conversational and helpful in your message.',
    '- For "converse", ask questions that help crystallize the idea into something actionable.',
    '- For "work", rewrite the task as a clear, complete task_description.',
    '- For "onboard"/"create", extract the project_name and confirm the action in your message.',
  ].join('\n');

  db.logEvent('thread.classifying', {
    repo: context.repo || null,
    actor: 'captain-picard',
    channel,
    thread_ts: threadTs,
    message_preview: latestMessage.substring(0, 100)
  });

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
  const validActions = ['work', 'converse', 'inquiry', 'onboard', 'create'];
  if (!parsed.action || !validActions.includes(parsed.action)) {
    return {
      action: 'converse',
      message: parsed.message || "Could you tell me more about what you have in mind?",
      task_description: null,
      project_name: null
    };
  }

  return {
    action: parsed.action,
    message: parsed.message || '',
    task_description: parsed.task_description || null,
    project_name: parsed.project_name || null
  };
}

// --- Response Routing ---

// Unified handler for classified messages — routes based on thread context
async function handleClassification(app, threadContext, classification) {
  const reporter = slack.slackReporter(app, threadContext.channel, threadContext.thread_ts);
  const hasMission = !!threadContext.mission_id;

  db.logEvent('thread.classification', {
    repo: threadContext.repo,
    actor: 'captain-picard',
    action: classification.action,
    channel: threadContext.channel,
    thread_ts: threadContext.thread_ts,
    has_mission: hasMission
  });

  // Conversational or informational — respond and stay in current state
  if (classification.action === 'converse' || classification.action === 'inquiry') {
    await reporter.post(classification.message);
    db.logEvent('thread.responded', {
      repo: threadContext.repo,
      actor: 'captain-picard',
      action: classification.action,
      channel: threadContext.channel,
      thread_ts: threadContext.thread_ts,
      response_preview: (classification.message || '').substring(0, 120)
    });
    const idleStatus = hasMission ? 'idle' : 'conversing';
    updateThreadStatus(threadContext.channel, threadContext.thread_ts, idleStatus);
    return { action: classification.action };
  }

  // Onboard or create project — signal back to caller
  if (classification.action === 'onboard' || classification.action === 'create') {
    if (!classification.project_name) {
      // Missing project name — let Picard ask for it conversationally
      await reporter.post(classification.message || "What's the project name?");
      updateThreadStatus(threadContext.channel, threadContext.thread_ts, 'conversing');
      return { action: 'converse' };
    }

    await reporter.post(classification.message || `Starting ${classification.action}...`);
    updateThreadStatus(threadContext.channel, threadContext.thread_ts, classification.action === 'onboard' ? 'onboarding' : 'creating');
    return {
      action: classification.action,
      project_name: classification.project_name,
      task_description: classification.task_description
    };
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
  _debounceTimers,
  _debounceMessages
};
