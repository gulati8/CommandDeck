'use strict';

const { App } = require('@slack/bolt');

const health = require('./lib/health');
const slack = require('./lib/slack');
const service = require('./lib/service');
const learn = require('./lib/learn');
const { logEvent } = require('./lib/observability');

// Active missions tracked for health patrol
const activeMissions = new Map();

// --- Core entry points (shared by Slack and CLI) ---

async function runMission(repo, prompt, context) {
  const result = await service.startMission(repo, prompt, {
    ...context,
    onMissionCreated: (missionState) => {
      activeMissions.set(missionState.mission_id, {
        mission_id: missionState.mission_id,
        repo: missionState.repo
      });
      logEvent('mission.active', missionState);
    }
  });
  activeMissions.delete(result.mission_id);
  return result;
}

async function runLearn(text, context) {
  return service.proposeLearning(text, context);
}

async function runStatus(missionId, context) {
  const result = await service.getMissionStatus(missionId);
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

    // Status command
    if (prompt.match(/^status\b/i)) {
      const missionId = prompt.replace(/^status\b\s*/i, '').trim();
      await runStatus(missionId, { channel, threadTs, reporter });
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

    try {
      await runMission(repo, task, { channel, threadTs, reporter });
    } catch (err) {
      await reporter.post(`Mission failed to start: ${err.message}`);
    }
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
        for (const ref of activeMissions.values()) {
          const mission = await service.getMissionStatus(ref.mission_id);
          if (!mission) continue;
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
module.exports = { runMission, runLearn, runStatus };

// Run if executed directly
if (require.main === module) {
  main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}
