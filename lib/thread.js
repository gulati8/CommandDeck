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

// --- Picard Assessment ---

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

function buildObjectivesSummary(missionState) {
  if (!missionState?.work_items?.length) return 'No objectives completed.';

  return missionState.work_items
    .filter(w => w.status === 'done')
    .map(w => `- ${w.id}: ${w.title} (${w.assigned_to})`)
    .join('\n');
}

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

function parseAssessment(stdout) {
  if (!stdout || !stdout.trim()) {
    return {
      action: 'acknowledge',
      message: "I had trouble processing that. Could you rephrase your feedback?",
      work_description: null
    };
  }

  try {
    const parsed = JSON.parse(stdout.trim());
    return validateAssessment(parsed);
  } catch {
    const jsonMatch = stdout.match(/\{[\s\S]*"action"\s*:\s*"[^"]+[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return validateAssessment(parsed);
      } catch { /* fall through */ }
    }
  }

  return {
    action: 'acknowledge',
    message: "I had trouble processing that. Could you rephrase your feedback?",
    work_description: null
  };
}

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

async function handleAssessment(app, threadContext, assessment) {
  const reporter = slack.slackReporter(app, threadContext.channel, threadContext.thread_ts);

  db.logEvent('thread.assessment', {
    repo: threadContext.repo,
    actor: 'captain-picard',
    action: assessment.action,
    channel: threadContext.channel,
    thread_ts: threadContext.thread_ts
  });

  if (assessment.action === 'clarify' || assessment.action === 'acknowledge') {
    await reporter.post(assessment.message);
    updateThreadStatus(threadContext.channel, threadContext.thread_ts, 'idle');
    return;
  }

  if (assessment.action === 'work') {
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

      if (result.status === 'pending_approval' && result.plan_message_ts) {
        slack.trackPlanApproval(result.plan_message_ts, {
          repo: threadContext.repo,
          mission_id: result.mission_id,
          channel: threadContext.channel,
          thread_ts: threadContext.thread_ts
        });
        updateThreadStatus(threadContext.channel, threadContext.thread_ts, 'pending_plan_approval');
        return;
      }

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
  _debounceTimers,
  _debounceMessages
};
