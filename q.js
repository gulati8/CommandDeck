'use strict';

const { App } = require('@slack/bolt');

const { Mission } = require('./lib/mission');
const state = require('./lib/state');
const learn = require('./lib/learn');
const health = require('./lib/health');
const slack = require('./lib/slack');

// Active missions tracked for health patrol
const activeMissions = new Map();

// --- Core entry points (shared by Slack and CLI) ---

async function runMission(repo, prompt, context) {
  const mission = new Mission(repo, prompt, context);

  // Register mission state immediately so health patrol can monitor from the start.
  // mission.start() creates the state internally, but we need a handle for the Map.
  // We wrap start() and register before awaiting execution.
  const startPromise = mission.start();

  // Poll briefly until missionId is set (happens synchronously at start of mission.start)
  await new Promise(resolve => {
    const check = () => {
      if (mission.missionId) return resolve();
      setTimeout(check, 50);
    };
    check();
  });

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

  return result;
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
      const repo = tracked?.repo;
      if (!repo) {
        await say({ text: `Mission ${missionId} not found in active missions.`, thread_ts: threadTs });
        return;
      }

      await runResume(repo, missionId, { channel, threadTs, reporter });
      return;
    }

    // Mission command — detect repo
    const repo = slack.detectRepoFromChannel(channel) || slack.parseRepoFromPrompt(prompt);
    if (!repo) {
      await say({
        text: "Which project? Use: @CommandDeck in <repo-name> <task>",
        thread_ts: threadTs
      });
      return;
    }

    const task = slack.parseTaskFromPrompt(prompt);
    if (!task) {
      await say({
        text: "What should I build? Use: @CommandDeck in <repo-name> <describe the task>",
        thread_ts: threadTs
      });
      return;
    }

    await runMission(repo, task, { channel, threadTs, reporter });
  });

  // Handle governance reactions
  app.event('reaction_added', async ({ event }) => {
    const reaction = event.reaction;
    const messageTs = event.item?.ts;
    if (!messageTs) return;

    const proposal = slack.getProposal(messageTs);
    if (!proposal) return;

    if (reaction === 'white_check_mark' || reaction === '+1') {
      const result = learn.approve(proposal.proposedPath, proposal.targetDir, proposal.fileName);
      slack.removeProposal(messageTs);
      console.log(`Learning approved: ${result.message}`);
    } else if (reaction === 'x' || reaction === '-1') {
      const result = learn.reject(proposal.proposedPath);
      slack.removeProposal(messageTs);
      console.log(`Learning rejected: ${result.message}`);
    }
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

  const app = startSlackApp();

  await app.start();
  console.log('🖖 CommandDeck Q is online. Listening for commands...');
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
