'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { App } = require('@slack/bolt');

const { Mission } = require('./lib/mission');
const state = require('./lib/state');
const db = require('./lib/db');
const learn = require('./lib/learn');
const health = require('./lib/health');
const pr = require('./lib/pr');
const slack = require('./lib/slack');
const thread = require('./lib/thread');
const auth = require('./lib/auth');
const scaffold = require('./lib/scaffold');
const { validateRepoName } = require('./lib/validate');
const { logEvent } = require('./lib/observability');
const telemetry = require('./lib/telemetry');
const tdb = require('./lib/telemetry-db');

// Active missions tracked for health patrol
const activeMissions = new Map();

// --- Core entry points ---

async function runMission(repo, prompt, context) {
  validateRepoName(repo);
  const mission = new Mission(repo, prompt, context);

  // Wrap mission with telemetry instrumentation
  const traced = telemetry.instrument(mission, [
    'start', 'decompose', 'workLoop', 'executeBatch',
    'mergeCompleted', 'runMandatoryReviews', 'approvePlan'
  ], {
    type: 'mission',
    repo,
    attributeExtractors: {
      start: () => ({ description: prompt }),
      executeBatch: (args) => ({ batch_size: args[0]?.length || 0 })
    }
  });

  const startPromise = traced.start();
  startPromise.catch(() => {});

  await waitForMissionId(mission, 5000).catch(() => {});

  if (!mission.missionId) {
    await startPromise;
  }

  activeMissions.set(mission.missionId, {
    mission_id: mission.missionId,
    repo,
    slack_channel: context.channel || null,
    slack_thread_ts: context.threadTs || null,
    mission
  });

  const result = await startPromise;

  activeMissions.set(result.mission_id, {
    ...activeMissions.get(result.mission_id),
    ...result
  });

  if (result.status === 'pending_approval' && context.slackApp && context.channel && context.threadTs) {
    const planMsgTs = result.plan_message_ts;
    if (planMsgTs) {
      slack.trackPlanApproval(planMsgTs, {
        repo,
        mission_id: result.mission_id,
        channel: context.channel,
        thread_ts: context.threadTs
      });
      thread.trackThread(context.channel, context.threadTs, {
        repo,
        mission_id: result.mission_id,
        original_description: prompt,
        status: 'pending_plan_approval'
      });
    }
    return result;
  }

  if (result.pr?.url && context.slackApp && context.channel && context.threadTs) {
    await postApprovalPrompt(context.slackApp, context.channel, context.threadTs, result);
  }

  return result;
}

async function postApprovalPrompt(app, channel, threadTs, mission) {
  try {
    const msg = await app.client.chat.postMessage({
      channel,
      thread_ts: threadTs,
      text: `🗳️ *PR ready for approval*\n` +
        `${mission.pr.url}\n\n` +
        `React to this message:\n` +
        `  :white_check_mark: to merge and deploy to production\n` +
        `  :x: to close the PR`
    });

    slack.trackPRApproval(msg.ts, {
      repo: mission.repo,
      mission_id: mission.mission_id,
      pr_number: mission.pr.number,
      pr_url: mission.pr.url,
      channel,
      thread_ts: threadTs
    });

    thread.trackThread(channel, threadTs, {
      repo: mission.repo,
      mission_id: mission.mission_id,
      integration_branch: mission.integration_branch,
      pr_number: mission.pr.number,
      pr_url: mission.pr.url,
      original_description: mission.description
    });
  } catch (err) {
    console.error('Failed to post approval prompt:', err.message);
  }
}

async function runResume(repo, missionId, context) {
  const mission = new Mission(repo, '', context);
  mission.missionId = missionId;
  mission.repo = repo;

  const result = await mission.resume();

  activeMissions.set(result.mission_id, {
    ...activeMissions.get(result.mission_id),
    ...result
  });

  if (result.pr?.url && context.slackApp && context.channel && context.threadTs) {
    await postApprovalPrompt(context.slackApp, context.channel, context.threadTs, result);
  }

  return result;
}

async function runLearn(text, context) {
  return learn.propose(text, context);
}

async function runStatus(missionId, context) {
  const result = await state.getMissionStatus(missionId, context);
  const message = slack.formatStatusMessage(result);
  await context.reporter.post(message);
  return result;
}

// --- PR approval handlers ---

async function handlePRMerge(approval, reporter) {
  try {
    await reporter.post('✅ Merging PR...');

    const mission = await state.readMission(approval.repo, approval.mission_id);
    if (!mission) {
      await reporter.post('❌ Mission state not found. Merge manually.');
      return;
    }

    const worktree = require('./lib/worktree');
    const projectDir = worktree.projectPath(approval.repo);
    const { execFileSync } = require('child_process');

    execFileSync('gh', [
      'pr', 'merge', String(approval.pr_number),
      '--merge', '--delete-branch'
    ], {
      cwd: projectDir,
      encoding: 'utf-8',
      stdio: 'pipe'
    });

    await pr.cleanup(mission, { reporter });

    if (approval.thread_ts) {
      thread.removeThread(approval.channel, approval.thread_ts);
    }

    await reporter.post(
      `✅ PR #${approval.pr_number} merged and deployed to production!\n` +
      `Branches cleaned up. GH Actions will handle the production deployment.`
    );
  } catch (err) {
    await reporter.post(`❌ Failed to merge PR: ${err.message}\nMerge manually: ${approval.pr_url}`);
  }
}

async function handlePRClose(approval, reporter) {
  try {
    await reporter.post('🗑️ Closing PR...');

    const worktree = require('./lib/worktree');
    const projectDir = worktree.projectPath(approval.repo);
    const { execFileSync } = require('child_process');

    execFileSync('gh', [
      'pr', 'close', String(approval.pr_number)
    ], {
      cwd: projectDir,
      encoding: 'utf-8',
      stdio: 'pipe'
    });

    const mission = await state.readMission(approval.repo, approval.mission_id);
    if (mission) {
      await pr.cleanup(mission, { reporter });
    }

    if (approval.thread_ts) {
      thread.removeThread(approval.channel, approval.thread_ts);
    }

    await reporter.post(`🗑️ PR #${approval.pr_number} closed. Branches cleaned up.`);
  } catch (err) {
    await reporter.post(`❌ Failed to close PR: ${err.message}\nClose manually: ${approval.pr_url}`);
  }
}

// --- Plan approval handlers ---

async function handlePlanApprove(planApproval, app) {
  const reporter = slack.slackReporter(app, planApproval.channel, planApproval.thread_ts);

  try {
    const mission = new Mission(planApproval.repo, '', {
      channel: planApproval.channel,
      threadTs: planApproval.thread_ts,
      reporter
    });
    mission.missionId = planApproval.mission_id;
    mission.state = await state.readMission(planApproval.repo, planApproval.mission_id);
    mission.prompt = mission.state.description;

    if (mission.state.status !== 'pending_approval') {
      await reporter.post(`Mission is ${mission.state.status}, not pending approval.`);
      return;
    }

    await reporter.post('✅ Plan approved — starting work...');
    thread.updateThreadStatus(planApproval.channel, planApproval.thread_ts, 'working');

    await mission.approvePlan();

    activeMissions.set(mission.missionId, {
      ...activeMissions.get(mission.missionId),
      ...mission.state,
      mission
    });

    if (mission.state.pr?.url) {
      await postApprovalPrompt(app, planApproval.channel, planApproval.thread_ts, mission.state);
    }
  } catch (err) {
    await reporter.post(`🔴 Mission failed: ${err.message}`);
  }
}

async function handlePlanReject(planApproval, app) {
  const reporter = slack.slackReporter(app, planApproval.channel, planApproval.thread_ts);

  try {
    const mission = new Mission(planApproval.repo, '', {
      channel: planApproval.channel,
      threadTs: planApproval.thread_ts,
      reporter
    });
    mission.missionId = planApproval.mission_id;
    mission.state = await state.readMission(planApproval.repo, planApproval.mission_id);

    await mission.rejectPlan();
    thread.removeThread(planApproval.channel, planApproval.thread_ts);
  } catch (err) {
    await reporter.post(`❌ Failed to abort mission: ${err.message}`);
  }
}

// --- Slack app setup ---

// Resolve meta-channel ID from bot username (e.g. command_deck → #command-deck)
let _metaChannelId = null;
async function resolveMetaChannel(app) {
  if (_metaChannelId) return _metaChannelId;
  try {
    const authResult = await app.client.auth.test();
    const botName = authResult.user || '';
    const channelName = botName.replace(/_/g, '-');

    let cursor;
    do {
      const result = await app.client.conversations.list({
        types: 'public_channel',
        limit: 200,
        cursor
      });
      const match = result.channels.find(c => c.name === channelName);
      if (match) {
        _metaChannelId = match.id;
        console.log(`  Meta-channel resolved: #${channelName} (${_metaChannelId})`);
        return _metaChannelId;
      }
      cursor = result.response_metadata?.next_cursor;
    } while (cursor);
  } catch (err) {
    console.error('Failed to resolve meta-channel:', err.message);
  }
  return null;
}

function startSlackApp() {
  const app = new App({
    token: process.env.SLACK_BOT_TOKEN,
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    socketMode: true,
    appToken: process.env.SLACK_APP_TOKEN
  });

  // Resolve meta-channel on first event
  let _metaChannelReady = null;
  function getMetaChannel() {
    if (!_metaChannelReady) _metaChannelReady = resolveMetaChannel(app);
    return _metaChannelReady;
  }

  // Handle @CommandDeck mentions
  app.event('app_mention', async ({ event, say }) => {
    const prompt = event.text.replace(/<@[^>]+>/g, '').trim();
    const channel = event.channel;
    const threadTs = event.ts;
    const reporter = slack.slackReporter(app, channel, threadTs);

    logEvent('slack.mention', {
      channel,
      message_preview: prompt.substring(0, 100)
    });

    // Learn/remember command
    if (prompt.match(/^(remember|learn):?\s/i)) {
      const learnText = prompt.replace(/^(remember|learn):?\s*/i, '').trim();
      const result = await runLearn(learnText, { channel, threadTs, reporter });

      if (result.needsApproval) {
        const msg = await say({
          text: slack.formatProposalMessage(result),
          thread_ts: threadTs
        });
        slack.trackProposal(msg.ts, {
          proposedPath: result.proposedPath,
          targetDir: result.targetDir,
          fileName: result.fileName
        });
      } else {
        await reporter.post(result.message);
      }
      return;
    }

    // Status command
    if (prompt.match(/^status(\s|$)/i)) {
      const missionId = prompt.replace(/^status\s*/i, '').trim() || null;
      await runStatus(missionId, { channel, threadTs, reporter });
      return;
    }

    // Resume command
    if (prompt.match(/^(resume|continue)(\s|$)/i)) {
      const missionId = prompt.replace(/^(resume|continue)\s*/i, '').trim();
      if (!missionId) {
        await say({ text: 'Usage: @CommandDeck resume <mission-id>', thread_ts: threadTs });
        return;
      }

      const tracked = activeMissions.get(missionId);
      let repo = tracked?.repo;
      if (!repo) {
        const missionState = await state.getMissionStatus(missionId);
        repo = missionState?.repo || null;
      }
      if (!repo) {
        await say({ text: `Mission ${missionId} not found.`, thread_ts: threadTs });
        return;
      }

      await runResume(repo, missionId, { channel, threadTs, reporter, slackApp: app });
      return;
    }

    // Create project command — only from meta-channel
    const createMatch = prompt.match(/^(?:create|build me|new project)\s+(?:project\s+)?(\S+)(?:\s*[:]\s*(.+))?$/i);
    if (createMatch) {
      const metaChannel = await getMetaChannel();
      if (metaChannel && channel !== metaChannel) {
        await say({
          text: `Project creation is only available in <#${metaChannel}>. Head there and try again.`,
          thread_ts: threadTs
        });
        return;
      }

      const projectName = createMatch[1];
      const description = createMatch[2]?.trim() || '';

      await say({
        text: `🚀 Creating project "${projectName}"...`,
        thread_ts: threadTs
      });

      try {
        const result = await scaffold.createProject(projectName, {
          description,
          slackApp: app,
          reporter,
          userId: event.user
        });

        const summary = result.steps
          .map(s => `  ${s.status === 'ok' ? '✅' : '❌'} ${s.step}${s.error ? ': ' + s.error : ''}`)
          .join('\n');

        await reporter.post(
          `🖖 Project "${projectName}" created!\n${summary}\n\n` +
          `Use: @CommandDeck in ${projectName} <task> to start a mission.`
        );

        if (description) {
          await runMission(projectName, description, { channel, threadTs, reporter, slackApp: app });
        }
      } catch (err) {
        await reporter.post(`❌ Failed to create project: ${err.message}`);
      }
      return;
    }

    // Onboard existing repo command — only from meta-channel
    const onboardMatch = prompt.match(/^onboard\s+(\S+)$/i);
    if (onboardMatch) {
      const metaChannel = await getMetaChannel();
      if (metaChannel && channel !== metaChannel) {
        await say({
          text: `Project onboarding is only available in <#${metaChannel}>. Head there and try again.`,
          thread_ts: threadTs
        });
        return;
      }

      const projectName = onboardMatch[1];

      await say({
        text: `📦 Onboarding existing project "${projectName}"...`,
        thread_ts: threadTs
      });

      try {
        const result = await scaffold.onboardProject(projectName, {
          slackApp: app,
          reporter,
          userId: event.user
        });

        const summary = result.steps
          .map(s => `  ${s.status === 'ok' ? '✅' : '❌'} ${s.step}${s.error ? ': ' + s.error : ''}`)
          .join('\n');

        await reporter.post(
          `🖖 Project "${projectName}" onboarded!\n${summary}\n\n` +
          `Use: @CommandDeck in ${projectName} <task> to start a mission.`
        );
      } catch (err) {
        await reporter.post(`❌ Failed to onboard project: ${err.message}`);
      }
      return;
    }

    // Detect repo from channel map or "in <project>" syntax
    let repo = slack.detectRepoFromChannel(channel);
    let task = prompt;

    if (!repo) {
      const promptRepo = slack.parseRepoFromPrompt(prompt);
      if (promptRepo) {
        const { listAvailableProjects } = require('./lib/mission');
        const available = listAvailableProjects();
        if (available.includes(promptRepo)) {
          const existingChannel = slack.findChannelForRepo(promptRepo);
          if (existingChannel && existingChannel !== channel) {
            await say({
              text: `Project "${promptRepo}" is already mapped to <#${existingChannel}>. Use that channel instead.`,
              thread_ts: threadTs
            });
            return;
          }
          scaffold.updateChannelMap(channel, promptRepo);
          repo = promptRepo;
          task = slack.parseTaskFromPrompt(prompt);
          await reporter.post(`Mapped this channel to project "${repo}".`);
        }
      }
    }

    // Classify intent — works with or without a repo context
    const context = {};
    if (repo) context.repo = repo;

    thread.trackThread(channel, threadTs, { repo: repo || null, status: 'conversing' });
    thread.updateThreadStatus(channel, threadTs, 'assessing');

    const classification = await thread.classifyMessage(app, channel, threadTs, task, context);

    const threadContext = thread.getThread(channel, threadTs) || { repo, channel, thread_ts: threadTs };
    const result = await thread.handleClassification(app, { ...threadContext, channel, thread_ts: threadTs }, classification);

    if (result?.needs_new_mission) {
      if (!result.repo) {
        await reporter.post("I'd like to help with that — which project should I work on?");
        thread.updateThreadStatus(channel, threadTs, 'conversing');
        return;
      }
      await runMission(result.repo, result.task_description || task, { channel, threadTs, reporter, slackApp: app });
    }

    // Handle onboard/create from conversational classification
    // (project_name is guaranteed present — handleClassification demotes to converse if missing)
    if (result?.action === 'onboard') {
      try {
        const onboardResult = await scaffold.onboardProject(result.project_name, {
          slackApp: app,
          reporter,
          userId: event.user
        });
        const summary = onboardResult.steps
          .map(s => `  ${s.status === 'ok' ? '✅' : '❌'} ${s.step}${s.error ? ': ' + s.error : ''}`)
          .join('\n');
        await reporter.post(
          `🖖 Project "${result.project_name}" onboarded!\n${summary}\n\n` +
          `Use: @CommandDeck in ${result.project_name} <task> to start a mission.`
        );
      } catch (err) {
        await reporter.post(`❌ Failed to onboard project: ${err.message}`);
      }
      thread.updateThreadStatus(channel, threadTs, 'conversing');
    }

    if (result?.action === 'create') {
      try {
        const createResult = await scaffold.createProject(result.project_name, {
          description: result.task_description || '',
          slackApp: app,
          reporter,
          userId: event.user
        });
        const summary = createResult.steps
          .map(s => `  ${s.status === 'ok' ? '✅' : '❌'} ${s.step}${s.error ? ': ' + s.error : ''}`)
          .join('\n');
        await reporter.post(
          `🖖 Project "${result.project_name}" created!\n${summary}\n\n` +
          `Use: @CommandDeck in ${result.project_name} <task> to start a mission.`
        );
        thread.updateThreadStatus(channel, threadTs, 'conversing');

        if (result.task_description) {
          await runMission(result.project_name, result.task_description, { channel, threadTs, reporter, slackApp: app });
        }
      } catch (err) {
        await reporter.post(`❌ Failed to create project: ${err.message}`);
        thread.updateThreadStatus(channel, threadTs, 'conversing');
      }
    }
  });

  // Handle governance reactions and PR approval reactions
  app.event('reaction_added', async ({ event }) => {
    const reaction = event.reaction;
    const messageTs = event.item?.ts;
    if (!messageTs) return;

    // Check for governance proposal reactions
    const proposal = slack.getProposal(messageTs);
    if (proposal) {
      if (reaction === 'white_check_mark' || reaction === '+1') {
        const result = learn.approve(proposal.proposedPath, proposal.targetDir, proposal.fileName);
        slack.removeProposal(messageTs);
        console.log(`Learning approved: ${result.message}`);
      } else if (reaction === 'x' || reaction === '-1') {
        const result = learn.reject(proposal.proposedPath);
        slack.removeProposal(messageTs);
        console.log(`Learning rejected: ${result.message}`);
      }
      return;
    }

    // Check for plan approval reactions
    const planApproval = slack.getPlanApproval(messageTs);
    if (planApproval) {
      if (reaction === 'white_check_mark' || reaction === '+1') {
        slack.removePlanApproval(messageTs);
        await handlePlanApprove(planApproval, app);
      } else if (reaction === 'x' || reaction === '-1') {
        slack.removePlanApproval(messageTs);
        await handlePlanReject(planApproval, app);
      }
      return;
    }

    // Check for PR approval reactions
    const approval = slack.getPRApproval(messageTs);
    if (!approval) return;

    const reporter = slack.slackReporter(app, approval.channel, approval.thread_ts);

    if (reaction === 'white_check_mark' || reaction === '+1') {
      await handlePRMerge(approval, reporter);
      slack.removePRApproval(messageTs);
    } else if (reaction === 'x' || reaction === '-1') {
      await handlePRClose(approval, reporter);
      slack.removePRApproval(messageTs);
    }
  });

  // Handle thread messages for conversational follow-up
  app.event('message', async ({ event }) => {
    if (event.bot_id || event.subtype) return;
    if (!event.thread_ts || event.thread_ts === event.ts) return;
    if (event.text && event.text.includes(`<@`)) return;

    const threadContext = thread.getThread(event.channel, event.thread_ts);
    if (!threadContext) return;

    logEvent('slack.thread_message', {
      repo: threadContext.repo,
      channel: event.channel,
      thread_ts: event.thread_ts,
      status: threadContext.status,
      message_preview: (event.text || '').substring(0, 100)
    });

    // Plan revision: user replies while plan is pending approval
    if (threadContext.status === 'pending_plan_approval') {
      thread.debounce(event.channel, event.thread_ts, event.text, async (messages) => {
        const feedback = messages.join('\n');
        const reporter = slack.slackReporter(app, event.channel, event.thread_ts);

        try {
          const mission = new Mission(threadContext.repo, '', {
            channel: event.channel,
            threadTs: event.thread_ts,
            reporter
          });
          mission.missionId = threadContext.mission_id;
          mission.state = await state.readMission(threadContext.repo, threadContext.mission_id);
          mission.prompt = mission.state.description;

          const result = await mission.revisePlan(feedback);

          if (result.planMsgTs) {
            slack.trackPlanApproval(result.planMsgTs, {
              repo: threadContext.repo,
              mission_id: threadContext.mission_id,
              channel: event.channel,
              thread_ts: event.thread_ts
            });
          }
        } catch (err) {
          await reporter.post(`🔴 Plan revision failed: ${err.message}`);
        }
      });
      return;
    }

    if (threadContext.status === 'working' || threadContext.status === 'launching') {
      const reporter = slack.slackReporter(app, event.channel, event.thread_ts);
      await reporter.post("I'm still working on the previous task. I'll respond when it's done.");
      return;
    }

    // Debounce messages, then classify and route
    thread.debounce(event.channel, event.thread_ts, event.text, async (messages) => {
      thread.updateThreadStatus(event.channel, event.thread_ts, 'assessing');

      const classification = await thread.classifyMessage(
        app, event.channel, event.thread_ts, messages,
        {
          repo: threadContext.repo,
          original_description: threadContext.original_description,
          pr_url: threadContext.pr_url,
          mission_id: threadContext.mission_id
        }
      );

      const result = await thread.handleClassification(app, {
        ...threadContext,
        channel: event.channel,
        thread_ts: event.thread_ts
      }, classification);

      // Pre-mission thread: classification said "work" with no existing mission
      if (result?.needs_new_mission && result.repo) {
        const reporter = slack.slackReporter(app, event.channel, event.thread_ts);
        await runMission(result.repo, result.task_description || messages.join('\n'), {
          channel: event.channel,
          threadTs: event.thread_ts,
          reporter,
          slackApp: app
        });
      }

      // Handle onboard/create from follow-up messages
      if (result?.action === 'onboard') {
        const reporter = slack.slackReporter(app, event.channel, event.thread_ts);
        try {
          const onboardResult = await scaffold.onboardProject(result.project_name, {
            slackApp: app,
            reporter,
            userId: event.user
          });
          const summary = onboardResult.steps
            .map(s => `  ${s.status === 'ok' ? '✅' : '❌'} ${s.step}${s.error ? ': ' + s.error : ''}`)
            .join('\n');
          await reporter.post(
            `🖖 Project "${result.project_name}" onboarded!\n${summary}\n\n` +
            `Use: @CommandDeck in ${result.project_name} <task> to start a mission.`
          );
        } catch (err) {
          await reporter.post(`❌ Failed to onboard project: ${err.message}`);
        }
        thread.updateThreadStatus(event.channel, event.thread_ts, 'conversing');
      }

      if (result?.action === 'create') {
        const reporter = slack.slackReporter(app, event.channel, event.thread_ts);
        try {
          const createResult = await scaffold.createProject(result.project_name, {
            description: result.task_description || '',
            slackApp: app,
            reporter,
            userId: event.user
          });
          const summary = createResult.steps
            .map(s => `  ${s.status === 'ok' ? '✅' : '❌'} ${s.step}${s.error ? ': ' + s.error : ''}`)
            .join('\n');
          await reporter.post(
            `🖖 Project "${result.project_name}" created!\n${summary}\n\n` +
            `Use: @CommandDeck in ${result.project_name} <task> to start a mission.`
          );
          if (result.task_description) {
            await runMission(result.project_name, result.task_description, {
              channel: event.channel,
              threadTs: event.thread_ts,
              reporter,
              slackApp: app
            });
          }
        } catch (err) {
          await reporter.post(`❌ Failed to create project: ${err.message}`);
        }
        thread.updateThreadStatus(event.channel, event.thread_ts, 'conversing');
      }
    });
  });

  // Start health patrol
  health.startPatrol(
    () => Array.from(activeMissions.values()),
    {
      post: async (msg) => {
        for (const mission of activeMissions.values()) {
          if (mission.slack_channel && mission.slack_thread_ts) {
            try {
              await app.client.chat.postMessage({
                channel: mission.slack_channel,
                thread_ts: mission.slack_thread_ts,
                text: msg
              });
            } catch (err) {
              console.error('Health patrol Slack post error:', err.message);
            }
          }
        }
      }
    }
  );

  return app;
}

// --- HTTP Server (Dashboard + API + Health) ---

const STATIC_DIR = path.join(__dirname, 'dashboard', 'public');
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function sendJSON(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(JSON.stringify(data));
}

function serveStatic(pathname, res) {
  if (pathname === '/') pathname = '/index.html';
  const filePath = path.join(STATIC_DIR, pathname);

  if (!filePath.startsWith(STATIC_DIR)) {
    res.writeHead(403);
    res.end();
    return;
  }

  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  try {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  } catch {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not found' }));
  }
}

// All known projects: SQLite repos + filesystem state dir (deduped)
function listAllProjects() {
  const dbRepos = new Set(db.listAllRepos());
  const projectsDir = path.join(state.STATE_DIR, 'projects');
  try {
    for (const d of fs.readdirSync(projectsDir, { withFileTypes: true })) {
      if (d.isDirectory()) dbRepos.add(d.name);
    }
  } catch { /* no projects dir */ }
  return [...dbRepos].sort();
}

// Evidence + health alerts still live on disk
function readEvidence(repo, missionId, objectiveId) {
  const evidencePath = path.join(
    state.STATE_DIR, 'projects', repo, 'missions', missionId,
    'artifacts', `evidence-${objectiveId}.json`
  );
  try {
    return JSON.parse(fs.readFileSync(evidencePath, 'utf-8'));
  } catch {
    return null;
  }
}

function readHealthAlerts(repo, missionId) {
  // Read from events table (new) and fall back to NDJSON file (legacy)
  const events = db.getTimeline(missionId)
    .filter(e => e.event === 'health.alert')
    .map(e => ({ ts: e.ts, ...e.payload }));

  if (events.length > 0) return events;

  // Legacy fallback: read from NDJSON file
  const alertPath = path.join(
    state.STATE_DIR, 'projects', repo, 'missions', missionId,
    'artifacts', 'health-alerts.ndjson'
  );
  try {
    return fs.readFileSync(alertPath, 'utf-8')
      .split('\n')
      .filter(Boolean)
      .map(line => JSON.parse(line));
  } catch {
    return [];
  }
}

function matchRoute(pathname) {
  let m = pathname.match(/^\/api\/projects\/([^/]+)\/missions$/);
  if (m) return { handler: 'projectMissions', repo: decodeURIComponent(m[1]) };

  m = pathname.match(/^\/api\/missions\/([^/]+)\/([^/]+)$/);
  if (m) return { handler: 'missionDetail', repo: decodeURIComponent(m[1]), missionId: decodeURIComponent(m[2]) };

  m = pathname.match(/^\/api\/missions\/([^/]+)\/([^/]+)\/timeline$/);
  if (m) return { handler: 'timeline', repo: decodeURIComponent(m[1]), missionId: decodeURIComponent(m[2]) };

  // Action routes
  m = pathname.match(/^\/api\/missions\/([^/]+)\/([^/]+)\/(approve|reject|reconnect)$/);
  if (m) return { handler: m[3], repo: decodeURIComponent(m[1]), missionId: decodeURIComponent(m[2]) };

  m = pathname.match(/^\/api\/missions\/([^/]+)\/([^/]+)\/pr\/(merge|close)$/);
  if (m) return { handler: `pr_${m[3]}`, repo: decodeURIComponent(m[1]), missionId: decodeURIComponent(m[2]) };

  return null;
}

// GET API handlers
function handleGetAPI(pathname, res, url) {
  if (pathname === '/api/health') {
    return sendJSON(res, 200, { status: 'ok', uptime: process.uptime() });
  }

  if (pathname === '/api/overview') {
    const globalConfig = state.loadGlobalConfig();
    const repos = listAllProjects();
    const overview = db.missionOverview();

    return sendJSON(res, 200, {
      uptime: process.uptime(),
      projects: repos.length,
      active_missions: overview.active,
      total_missions: overview.total,
      active_workers: overview.workers,
      config: {
        github_org: globalConfig.github_org,
        domain: globalConfig.domain
      }
    });
  }

  if (pathname === '/api/projects') {
    const repos = listAllProjects();

    const projects = repos.map(repo => {
      const config = state.loadProjectConfig(repo);
      const missions = db.listMissionsByRepo(repo);
      const channelId = db.getChannelForRepo(repo);
      return {
        repo,
        channel_id: channelId || null,
        mission_count: missions.length,
        config: {
          default_branch: config.default_branch,
          max_workers: config.max_workers
        }
      };
    });

    return sendJSON(res, 200, projects);
  }

  if (pathname === '/api/pending') {
    const prApprovals = db.listApprovalsByType('pr');
    const planApprovals = db.listApprovalsByType('plan');
    const activeThreads = db.listActiveThreads();

    return sendJSON(res, 200, {
      pr_approvals: prApprovals,
      plan_approvals: planApprovals,
      active_threads: activeThreads
    });
  }

  if (pathname === '/api/orphaned') {
    return sendJSON(res, 200, db.getOrphanedMissions());
  }

  if (pathname === '/api/events/recent') {
    return sendJSON(res, 200, tdb.recentEvents(30));
  }

  if (pathname === '/api/events/all') {
    return sendJSON(res, 200, tdb.recentEvents(200));
  }

  // --- Telemetry API endpoints ---

  if (pathname === '/api/traces') {
    const params = {
      limit: parseInt(url?.searchParams?.get('limit') || '50', 10),
      status: url?.searchParams?.get('status') || undefined,
      repo: url?.searchParams?.get('repo') || undefined,
      mission_id: url?.searchParams?.get('mission_id') || undefined
    };
    return sendJSON(res, 200, tdb.listTraces(params));
  }

  // Parse traces routes: /api/traces/:traceId
  const traceMatch = pathname.match(/^\/api\/traces\/([^/]+)$/);
  if (traceMatch) {
    const traceData = tdb.getTrace(decodeURIComponent(traceMatch[1]));
    if (!traceData) return sendJSON(res, 404, { error: 'trace not found' });
    return sendJSON(res, 200, traceData);
  }

  // Mission trace: /api/missions/:repo/:missionId/trace
  const missionTraceMatch = pathname.match(/^\/api\/missions\/([^/]+)\/([^/]+)\/trace$/);
  if (missionTraceMatch) {
    const traceData = tdb.getTraceByMission(decodeURIComponent(missionTraceMatch[2]));
    if (!traceData) return sendJSON(res, 404, { error: 'no trace for this mission' });
    return sendJSON(res, 200, traceData);
  }

  if (pathname === '/api/logs') {
    const params = {
      mission_id: url?.searchParams?.get('mission_id') || undefined,
      trace_id: url?.searchParams?.get('trace_id') || undefined,
      since: url?.searchParams?.get('since') || undefined,
      level: url?.searchParams?.get('level') || undefined,
      source: url?.searchParams?.get('source') || undefined,
      limit: parseInt(url?.searchParams?.get('limit') || '100', 10)
    };
    return sendJSON(res, 200, tdb.queryLogs(params));
  }

  if (pathname === '/api/metrics') {
    return sendJSON(res, 200, tdb.getMetrics());
  }

  if (pathname === '/api/containers') {
    const DOCKER_SOCKET = process.env.DOCKER_SOCKET || '/var/run/docker.sock';
    try {
      fs.accessSync(DOCKER_SOCKET);
    } catch {
      return sendJSON(res, 200, []);
    }
    // Fetch containers via docker socket
    const req = http.get({ socketPath: DOCKER_SOCKET, path: '/containers/json?all=true' }, (cRes) => {
      let data = '';
      cRes.on('data', chunk => { data += chunk; });
      cRes.on('end', () => {
        try {
          const containers = JSON.parse(data);
          const result = containers.map(c => {
            const name = (c.Names?.[0] || '').replace(/^\//, '');
            let cHealth = null;
            if (c.Status?.includes('healthy') && !c.Status?.includes('unhealthy')) cHealth = 'healthy';
            else if (c.Status?.includes('unhealthy')) cHealth = 'unhealthy';
            return { name, image: c.Image, state: c.State, status: c.Status, health: cHealth };
          }).sort((a, b) => a.name.localeCompare(b.name));
          sendJSON(res, 200, result);
        } catch { sendJSON(res, 200, []); }
      });
    });
    req.setTimeout(3000, () => { req.destroy(); sendJSON(res, 200, []); });
    req.on('error', () => sendJSON(res, 200, []));
    return; // async
  }

  const route = matchRoute(pathname);
  if (!route) return sendJSON(res, 404, { error: 'not found' });

  if (route.handler === 'projectMissions') {
    const missions = db.listMissionsByRepo(route.repo);
    const result = missions.map(m => {
      const objs = db.getObjectives(m.mission_id);
      const done = objs.filter(o => o.status === 'done').length;
      const total = objs.length;
      return {
        ...m,
        work_items: objs,
        progress: { done, total, percent: total > 0 ? Math.round((done / total) * 100) : 0 }
      };
    });
    return sendJSON(res, 200, result);
  }

  if (route.handler === 'missionDetail') {
    const m = db.getMission(route.missionId);
    if (!m) return sendJSON(res, 404, { error: 'mission not found' });

    const objs = db.getObjectives(route.missionId);
    const done = objs.filter(o => o.status === 'done').length;
    const total = objs.length;

    const workItems = objs.map(item => {
      const ev = readEvidence(m.repo, m.mission_id, item.id);
      return { ...item, evidence: ev };
    });

    const sessionLog = db.getSessionLog(route.missionId);
    const timeline = db.getTimeline(route.missionId);

    return sendJSON(res, 200, {
      ...m,
      work_items: workItems,
      session_log: sessionLog,
      progress: { done, total, percent: total > 0 ? Math.round((done / total) * 100) : 0 },
      health_alerts: readHealthAlerts(m.repo, m.mission_id),
      timeline
    });
  }

  if (route.handler === 'timeline') {
    return sendJSON(res, 200, db.getTimeline(route.missionId));
  }

  return sendJSON(res, 404, { error: 'not found' });
}

// POST API handlers (actions)
async function handlePostAPI(pathname, body, res, slackApp) {
  const route = matchRoute(pathname);

  if (pathname === '/api/missions') {
    // Start a new mission from dashboard
    if (!body.repo || !body.prompt) {
      return sendJSON(res, 400, { error: 'repo and prompt required' });
    }
    try {
      const reporter = {
        post: async (msg) => { console.log('[dashboard]', msg); return null; }
      };
      const context = { reporter };

      // If Slack thread requested and we have a slack app
      if (body.slack_thread && slackApp) {
        const channelId = db.getChannelForRepo(body.repo);
        if (channelId) {
          const threadResult = await slackApp.client.chat.postMessage({
            channel: channelId,
            text: `🖖 Mission started from dashboard: "${body.prompt}"`
          });
          context.channel = channelId;
          context.threadTs = threadResult.ts;
          context.slackApp = slackApp;
          context.reporter = slack.slackReporter(slackApp, channelId, threadResult.ts);
        }
      }

      const result = await runMission(body.repo, body.prompt, context);
      return sendJSON(res, 200, { mission_id: result.mission_id, status: result.status });
    } catch (err) {
      return sendJSON(res, 500, { error: err.message });
    }
  }

  if (!route) return sendJSON(res, 404, { error: 'not found' });

  if (route.handler === 'approve') {
    try {
      const m = db.getMission(route.missionId);
      if (!m) return sendJSON(res, 404, { error: 'mission not found' });

      if (slackApp && m.slack_channel && m.slack_thread_ts) {
        await handlePlanApprove({
          repo: m.repo,
          mission_id: m.mission_id,
          channel: m.slack_channel,
          thread_ts: m.slack_thread_ts
        }, slackApp);
      } else {
        const mission = new Mission(m.repo, '', {
          reporter: { post: async (msg) => { console.log('[dashboard]', msg); return null; } }
        });
        mission.missionId = m.mission_id;
        mission.state = await state.readMission(m.repo, m.mission_id);
        mission.prompt = mission.state.description;
        await mission.approvePlan();
      }
      return sendJSON(res, 200, { ok: true });
    } catch (err) {
      return sendJSON(res, 500, { error: err.message });
    }
  }

  if (route.handler === 'reject') {
    try {
      const m = db.getMission(route.missionId);
      if (!m) return sendJSON(res, 404, { error: 'mission not found' });

      const mission = new Mission(m.repo, '', {
        reporter: { post: async (msg) => { console.log('[dashboard]', msg); return null; } }
      });
      mission.missionId = m.mission_id;
      mission.state = await state.readMission(m.repo, m.mission_id);
      await mission.rejectPlan();
      return sendJSON(res, 200, { ok: true });
    } catch (err) {
      return sendJSON(res, 500, { error: err.message });
    }
  }

  if (route.handler === 'reconnect') {
    try {
      if (!body.slack_thread_url) {
        return sendJSON(res, 400, { error: 'slack_thread_url required' });
      }

      const m = db.getMission(route.missionId);
      if (!m) return sendJSON(res, 404, { error: 'mission not found' });

      // Parse Slack URL: https://workspace.slack.com/archives/CHANNEL/pTIMESTAMP
      const urlMatch = body.slack_thread_url.match(/archives\/([A-Z0-9]+)\/p(\d+)/);
      if (!urlMatch) {
        return sendJSON(res, 400, { error: 'Invalid Slack thread URL' });
      }

      const channel = urlMatch[1];
      const threadTs = urlMatch[2].replace(/^(\d{10})(\d{6})$/, '$1.$2');

      // Update mission with Slack info
      db.updateMission(route.missionId, {
        slack_channel: channel,
        slack_thread_ts: threadTs
      });

      // Track thread for follow-ups
      db.trackThread(channel, threadTs, {
        repo: m.repo,
        mission_id: m.mission_id,
        integration_branch: m.integration_branch,
        pr_number: m.pr?.number,
        pr_url: m.pr?.url,
        original_description: m.description,
        status: 'idle'
      });

      // Post approval prompt if PR is open
      if (slackApp && m.pr?.url) {
        await postApprovalPrompt(slackApp, channel, threadTs, m);
      }

      db.logEvent('mission.reconnected', {
        mission_id: m.mission_id,
        repo: m.repo,
        actor: 'dashboard'
      });

      return sendJSON(res, 200, { ok: true, channel, thread_ts: threadTs });
    } catch (err) {
      return sendJSON(res, 500, { error: err.message });
    }
  }

  if (route.handler === 'pr_merge') {
    try {
      const m = db.getMission(route.missionId);
      if (!m) return sendJSON(res, 404, { error: 'mission not found' });
      if (!m.pr?.number) return sendJSON(res, 400, { error: 'no PR for this mission' });

      const reporter = { post: async (msg) => { console.log('[dashboard]', msg); return null; } };
      await handlePRMerge({
        repo: m.repo,
        mission_id: m.mission_id,
        pr_number: m.pr.number,
        pr_url: m.pr.url,
        channel: m.slack_channel,
        thread_ts: m.slack_thread_ts
      }, reporter);
      return sendJSON(res, 200, { ok: true });
    } catch (err) {
      return sendJSON(res, 500, { error: err.message });
    }
  }

  if (route.handler === 'pr_close') {
    try {
      const m = db.getMission(route.missionId);
      if (!m) return sendJSON(res, 404, { error: 'mission not found' });
      if (!m.pr?.number) return sendJSON(res, 400, { error: 'no PR for this mission' });

      const reporter = { post: async (msg) => { console.log('[dashboard]', msg); return null; } };
      await handlePRClose({
        repo: m.repo,
        mission_id: m.mission_id,
        pr_number: m.pr.number,
        pr_url: m.pr.url,
        channel: m.slack_channel,
        thread_ts: m.slack_thread_ts
      }, reporter);
      return sendJSON(res, 200, { ok: true });
    } catch (err) {
      return sendJSON(res, 500, { error: err.message });
    }
  }

  return sendJSON(res, 404, { error: 'not found' });
}

// --- HTTP Server ---

function createHTTPServer(slackApp) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);

    // CORS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      });
      res.end();
      return;
    }

    if (req.method === 'GET') {
      // SSE endpoint for live telemetry streaming
      if (url.pathname === '/api/telemetry/stream') {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*'
        });
        res.write('data: {"type":"connected"}\n\n');
        telemetry.addSSEClient(res);
        // Keep connection alive with periodic heartbeats
        const heartbeat = setInterval(() => {
          try { res.write(': heartbeat\n\n'); } catch { clearInterval(heartbeat); }
        }, 30000);
        res.on('close', () => clearInterval(heartbeat));
        return;
      }

      if (url.pathname.startsWith('/api/')) {
        try {
          return handleGetAPI(url.pathname, res, url);
        } catch (err) {
          console.error('API error:', err.message);
          return sendJSON(res, 500, { error: 'internal server error' });
        }
      }
      return serveStatic(url.pathname, res);
    }

    if (req.method === 'POST' && url.pathname.startsWith('/api/')) {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          await handlePostAPI(url.pathname, parsed, res, slackApp);
        } catch (err) {
          console.error('API error:', err.message);
          sendJSON(res, 500, { error: 'internal server error' });
        }
      });
      return;
    }

    sendJSON(res, 405, { error: 'method not allowed' });
  });

  server.on('error', (err) => {
    console.error('HTTP server error:', err.message);
  });

  return server;
}

// --- Main ---

async function main() {
  console.log('🖖 CommandDeck v4 starting...');

  // Initialize SQLite databases
  db.getDb();
  console.log('  ✅ App database initialized');

  // Initialize telemetry (OTel + telemetry.db + Unix socket)
  telemetry.init();
  const migratedEvents = tdb.migrateEventsFromAppDb();
  if (migratedEvents > 0) {
    console.log(`  ✅ Migrated ${migratedEvents} events from app.db → telemetry.db`);
  }
  console.log('  ✅ Telemetry initialized (OTel + telemetry.db + socket)');

  // Migrate existing JSON state if needed
  const missionCount = db.missionOverview().total;
  if (missionCount === 0) {
    console.log('  📦 Checking for JSON state to migrate...');
    const migrated = db.migrateFromJSON(state.STATE_DIR);
    if (migrated.missions > 0 || migrated.channels > 0) {
      console.log(`  ✅ Migrated: ${migrated.missions} missions, ${migrated.channels} channels, ${migrated.threads} threads, ${migrated.approvals} approvals`);
    }
  }

  if (!process.env.SLACK_BOT_TOKEN || !process.env.SLACK_APP_TOKEN) {
    console.error('Missing SLACK_BOT_TOKEN or SLACK_APP_TOKEN. Set environment variables and restart.');
    process.exit(1);
  }

  // Check Claude Code auth
  const authOk = await auth.startupCheck();
  if (!authOk) {
    console.warn('⚠️ Claude Code not authenticated. Missions will fail until auth is completed.');
  }

  // Reset stale threads
  db.resetStaleThreads();

  // Start Slack app
  const slackApp = startSlackApp();
  await slackApp.start();
  console.log('  ✅ Slack bot connected (socket mode)');

  // Start HTTP server (dashboard + API + health)
  const httpPort = parseInt(process.env.COMMANDDECK_HTTP_PORT || '3000', 10);
  const httpServer = createHTTPServer(slackApp);
  httpServer.listen(httpPort, () => {
    console.log(`  ✅ HTTP server on port ${httpPort} (dashboard + API + health)`);
    console.log('🖖 CommandDeck v4 is online.');
  });
}

function waitForMissionId(mission, timeoutMs) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const check = () => {
      if (mission.missionId) return resolve();
      if (Date.now() - started >= timeoutMs) {
        return reject(new Error('Timed out waiting for mission initialization'));
      }
      setTimeout(check, 50);
    };
    check();
  });
}

// Export for testing
module.exports = { runMission, runResume, runLearn, runStatus, createHTTPServer };

if (require.main === module) {
  main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}
