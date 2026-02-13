#!/usr/bin/env node
'use strict';

const { program } = require('commander');
const { runMission, runLearn, runStatus } = require('./q');
const { consoleReporter } = require('./lib/slack');
const learn = require('./lib/learn');

const reporter = consoleReporter();

program
  .name('commanddeck')
  .description('CommandDeck — Multi-agent development orchestration')
  .version('3.0.0');

program
  .command('run <repo> <prompt>')
  .description('Start a new mission')
  .action(async (repo, prompt) => {
    try {
      const result = await runMission(repo, prompt, { reporter });
      if (result.pr?.url) {
        console.log(`\nPR: ${result.pr.url}`);
      }
      process.exit(result.status === 'failed' ? 1 : 0);
    } catch (err) {
      console.error(`Mission failed: ${err.message}`);
      process.exit(1);
    }
  });

program
  .command('learn <text>')
  .description('Propose a new learning')
  .action(async (text) => {
    try {
      const result = await runLearn(text, { reporter });
      console.log(result.message);

      if (result.needsApproval) {
        console.log(`\nPending approval. To approve from CLI:`);
        console.log(`  commanddeck approve "${result.proposedPath}"`);
      }
    } catch (err) {
      console.error(`Learn failed: ${err.message}`);
      process.exit(1);
    }
  });

program
  .command('approve <path>')
  .description('Approve a pending learning')
  .action(async (proposedPath) => {
    // We need to figure out targetDir and fileName from the path
    const path = require('path');
    const stateDir = process.env.COMMANDDECK_STATE_DIR || require('path').join(process.env.HOME, '.commanddeck');

    const fileName = require('path').basename(proposedPath);
    let targetDir;

    if (proposedPath.includes('/proposed/standards/')) {
      targetDir = require('path').join(stateDir, 'standards');
    } else if (proposedPath.includes('/proposed/crew/')) {
      targetDir = require('path').join(stateDir, 'crew');
    } else if (proposedPath.includes('/proposed/playbooks/')) {
      targetDir = require('path').join(stateDir, 'playbooks');
    } else {
      console.error('Cannot determine target directory from path');
      process.exit(1);
    }

    const result = learn.approve(proposedPath, targetDir, fileName);
    console.log(result.message);
  });

program
  .command('reject <path>')
  .description('Reject a pending learning')
  .action(async (proposedPath) => {
    const result = learn.reject(proposedPath);
    console.log(result.message);
  });

program
  .command('pending')
  .description('List pending learning proposals')
  .action(async () => {
    const pending = learn.listPending();
    if (pending.length === 0) {
      console.log('No pending proposals.');
      return;
    }

    console.log(`${pending.length} pending proposal(s):\n`);
    for (const p of pending) {
      console.log(`  [${p.scope}] ${p.name}`);
      console.log(`    Path: ${p.path}`);
    }
  });

program
  .command('status [mission-id]')
  .description('Check mission status')
  .action(async (missionId) => {
    try {
      if (!missionId) {
        console.log('Usage: commanddeck status <mission-id>');
        return;
      }
      await runStatus(missionId, { reporter });
    } catch (err) {
      console.error(`Status check failed: ${err.message}`);
      process.exit(1);
    }
  });

program.parse();
