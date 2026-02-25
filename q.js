'use strict';

const { App } = require('@slack/bolt');

const { Mission } = require('./lib/mission');
const state = require('./lib/state');
const learn = require('./lib/learn');
const health = require('./lib/health');
const pr = require('./lib/pr');
const { createHealthServer } = require('./lib/http-health');
const slack = require('./lib/slack');
const thread = require('./lib/thread');
const auth = require('./lib/auth');
const scaffold = require('./lib/scaffold');
const { validateRepoName } = require('./lib/validate');
const { logEvent } = require('./lib/observability');

// Active missions tracked for health patrol
const activeMissions = new Map();

// --- Core entry points (shared by Slack and CLI) ---

async function runMission(repo, prompt, context) {
  validateRepoName(repo);
  const mission = new Mission(repo, prompt, context);

  // Register mission state immediately so health patrol can monitor from the start.
  // mission.start() creates the state internally, but we need a handle for the Map.
  // Attach .catch() to prevent unhandled rejection, then await separately.
  const startPromise = mission.start();
  startPromise.catch(() => {}); // prevent unhandled rejection

  // Wait for mission ID to become available
  await waitForMissionId(mission, 5000).catch(() => {});

  if (!mission.missionId) {
    // If we still have no ID, the start promise failed — rethrow
    await startPromise; // will throw the original error
  }

  // Register for health patrol as soon as we have the mission ID
  activeMissions.set(mission.missionId, {
    mission_id: mission.missionId,
    repo,
    slack_channel: context.channel || null,
    slack_thread_ts: context.threadTs || null,
    mission // keep reference for resume
  });

  const result = await startPromise;

  // Update the tracked entry with final state
  activeMissions.set(result.mission_id, {
    ...activeMissions.get(result.mission_id),
    ...result
  });

  // If mission is pending approval (Slack mode), track for reactions
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

  // If mission created a PR and we're in Slack, post approval prompt
  if (result.pr?.url && context.slackApp && context.channel && context.threadTs) {
    await postApprovalPrompt(context.slackApp, context.channel, context.threadTs, result);
  }

  return result;
}

// Post a Slack message with approve/reject instructions and track it for reactions
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

    // Register thread for conversational follow-up
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

  // If resume completed with a PR and we're in Slack, post approval prompt
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

    // Merge the PR via gh CLI
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

    // Clean up local branches
    await pr.cleanup(mission, { reporter });

    // Untrack the thread — no more follow-ups
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

    // Untrack the thread — no more follow-ups
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

    // Update thread status
    thread.updateThreadStatus(planApproval.channel, planApproval.thread_ts, 'working');

    await mission.approvePlan();

    // Update tracked mission
    activeMissions.set(mission.missionId, {
      ...activeMissions.get(mission.missionId),
      ...mission.state,
      mission
    });

    // If mission created a PR, post approval prompt
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

    // Clean up thread tracking
    thread.removeThread(planApproval.channel, planApproval.thread_ts);
  } catch (err) {
    await reporter.post(`❌ Failed to abort mission: ${err.message}`);
  }
}

// --- Slack app setup ---

function startSlackApp() {
  const app = new App({
    token: process.env.SLACK_BOT_TOKEN,
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    socketMode: true,
    appToken: process.env.SLACK_APP_TOKEN
  });

  // Handle @CommandDeck mentions
  app.event('app_mention', async ({ event, say }) => {
    const prompt = event.text.replace(/<@[^>]+>/g, '').trim();
    const channel = event.channel;
    const threadTs = event.ts;
    const reporter = slack.slackReporter(app, channel, threadTs);

    // Learn/remember command
    if (prompt.match(/^(remember|learn):?\s/i)) {
      const learnText = prompt.replace(/^(remember|learn):?\s*/i, '').trim();
      const result = await runLearn(learnText, { channel, threadTs, reporter });

      if (result.needsApproval) {
        const msg = await say({
          text: slack.formatProposalMessage(result),
          thread_ts: threadTs
        });
        // Track for governance reaction handling
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

    // Status command — supports "status" (latest) or "status <id>"
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

      // Find the repo for this mission from active missions or state
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

    // Create project command
    const createMatch = prompt.match(/^(?:create|build me|new project)\s+(?:project\s+)?(\S+)(?:\s*[:]\s*(.+))?$/i);
    if (createMatch) {
      const projectName = createMatch[1];
      const description = createMatch[2]?.trim() || '';

      await say({
        text: `🚀 Creating project "${projectName}"...`,
        thread_ts: threadTs
      });

      try {
        const result = await scaffold.createProject(projectName, {
          description,
          slackApp: app
        });

        const summary = result.steps
          .map(s => `  ${s.status === 'ok' ? '✅' : '❌'} ${s.step}${s.error ? ': ' + s.error : ''}`)
          .join('\n');

        await reporter.post(
          `🖖 Project "${projectName}" created!\n${summary}\n\n` +
          `Use: @CommandDeck in ${projectName} <task> to start a mission.`
        );

        // If description provided, start a mission automatically
        if (description) {
          await runMission(projectName, description, { channel, threadTs, reporter, slackApp: app });
        }
      } catch (err) {
        await reporter.post(`❌ Failed to create project: ${err.message}`);
      }
      return;
    }

    // Mission command — detect repo from channel map or prompt
    const { listAvailableProjects } = require('./lib/mission');
    let repo = slack.detectRepoFromChannel(channel);
    let task = prompt;

    if (!repo) {
      // Channel not mapped — check if prompt specifies a project
      const promptRepo = slack.parseRepoFromPrompt(prompt);

      if (promptRepo) {
        // Validate the project exists on disk
        const available = listAvailableProjects();
        if (!available.includes(promptRepo)) {
          const list = available.length
            ? available.map(p => `  • ${p}`).join('\n')
            : '  (none — clone a repo first)';
          await say({
            text: `Project "${promptRepo}" not found.\n\nAvailable projects:\n${list}`,
            thread_ts: threadTs
          });
          return;
        }

        // Check if this project already has a different channel mapped
        const existingChannel = slack.findChannelForRepo(promptRepo);
        if (existingChannel && existingChannel !== channel) {
          await say({
            text: `Project "${promptRepo}" is already mapped to <#${existingChannel}>. Use that channel instead.`,
            thread_ts: threadTs
          });
          return;
        }

        // Auto-map this channel to the project
        scaffold.updateChannelMap(channel, promptRepo);
        repo = promptRepo;
        task = slack.parseTaskFromPrompt(prompt);
        await reporter.post(`Mapped this channel to project "${repo}".`);
      } else {
        // No repo anywhere — list available projects
        const available = listAvailableProjects();
        const list = available.length
          ? available.map(p => {
            const ch = slack.findChannelForRepo(p);
            return ch ? `  • ${p} → <#${ch}>` : `  • ${p}`;
          }).join('\n')
          : '  (none — clone a repo first)';
        await say({
          text: `Which project? Use: \`@CommandDeck in <project> <task>\`\n\nAvailable projects:\n${list}`,
          thread_ts: threadTs
        });
        return;
      }
    }

    if (!task || !task.trim()) {
      await say({
        text: "What should I build? Describe the task after the project name.",
        thread_ts: threadTs
      });
      return;
    }

    await runMission(repo, task, { channel, threadTs, reporter, slackApp: app });
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
    // Ignore bots and system messages
    if (event.bot_id || event.subtype) return;

    // Only thread replies (not top-level messages)
    if (!event.thread_ts || event.thread_ts === event.ts) return;

    // Skip @mentions — let the app_mention handler deal with those
    if (event.text && event.text.includes(`<@`)) return;

    const threadContext = thread.getThread(event.channel, event.thread_ts);
    if (!threadContext) return; // Not a tracked thread

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

          // Track new plan message for reactions
          if (result.planMsgTs) {
            // Remove old plan approval tracking (all existing for this mission)
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

    if (threadContext.status === 'working') {
      const reporter = slack.slackReporter(app, event.channel, event.thread_ts);
      await reporter.post("I'm still working on the previous follow-up. I'll respond when it's done.");
      return;
    }

    if (threadContext.status === 'assessing') {
      // Already assessing — debounce will collect this message
    }

    // Debounce messages, then assess
    thread.debounce(event.channel, event.thread_ts, event.text, async (messages) => {
      thread.updateThreadStatus(event.channel, event.thread_ts, 'assessing');
      const assessment = await thread.assessFeedback(app, threadContext, messages);
      await thread.handleAssessment(app, threadContext, assessment);
    });
  });

  // Start health patrol
  health.startPatrol(
    () => Array.from(activeMissions.values()),
    {
      post: async (msg) => {
        // Post health alerts to each mission's Slack thread
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

// --- Main ---

async function main() {
  console.log('🖖 CommandDeck Q starting...');

  if (!process.env.SLACK_BOT_TOKEN || !process.env.SLACK_APP_TOKEN) {
    console.error('Missing SLACK_BOT_TOKEN or SLACK_APP_TOKEN. Set environment variables and restart.');
    process.exit(1);
  }

  // Check Claude Code auth before accepting missions
  const authOk = await auth.startupCheck();
  if (!authOk) {
    console.warn('⚠️ Claude Code not authenticated. Missions will fail until auth is completed.');
  }

  // Reset any threads stuck in 'assessing' from a previous crash
  thread.resetStaleThreads();

  const app = startSlackApp();

  await app.start();
  console.log('🖖 CommandDeck Q is online. Listening for commands...');

  // Start HTTP health endpoint
  const httpPort = parseInt(process.env.COMMANDDECK_HTTP_PORT || '3001', 10);
  createHealthServer(httpPort);
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

// Export for CLI usage
module.exports = { runMission, runResume, runLearn, runStatus };

// Run if executed directly
if (require.main === module) {
  main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}
