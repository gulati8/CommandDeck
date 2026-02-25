#!/usr/bin/env node
'use strict';

const { program } = require('commander');
const path = require('path');
const { runMission, runResume, runLearn, runStatus } = require('./q');
const { consoleReporter } = require('./lib/slack');
const learn = require('./lib/learn');
const state = require('./lib/state');
const scaffold = require('./lib/scaffold');
const { validateRepoName } = require('./lib/validate');

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
      validateRepoName(repo);
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
  .command('resume <mission-id>')
  .description('Resume a pending-approval mission')
  .action(async (missionId) => {
    try {
      // Find the mission to get its repo
      const missionState = await state.getMissionStatus(missionId);
      if (!missionState) {
        console.error(`Mission ${missionId} not found.`);
        process.exit(1);
      }

      const result = await runResume(missionState.repo, missionId, { reporter });
      if (result.pr?.url) {
        console.log(`\nPR: ${result.pr.url}`);
      }
      process.exit(result.status === 'failed' ? 1 : 0);
    } catch (err) {
      console.error(`Resume failed: ${err.message}`);
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
    const stateDir = process.env.COMMANDDECK_STATE_DIR || path.join(process.env.HOME, '.commanddeck');
    const fileName = path.basename(proposedPath);
    let targetDir;

    if (proposedPath.includes('/proposed/standards/')) {
      targetDir = path.join(stateDir, 'standards');
    } else if (proposedPath.includes('/proposed/crew/')) {
      targetDir = path.join(stateDir, 'crew');
    } else if (proposedPath.includes('/proposed/playbooks/')) {
      targetDir = path.join(stateDir, 'playbooks');
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
  .description('Check mission status (omit mission-id to show latest)')
  .action(async (missionId) => {
    try {
      // Pass null to get latest mission when no ID given
      await runStatus(missionId || null, { reporter });
    } catch (err) {
      console.error(`Status check failed: ${err.message}`);
      process.exit(1);
    }
  });

program
  .command('create <name>')
  .description('Create a new project with full scaffolding')
  .option('-d, --description <desc>', 'Project description')
  .option('-p, --port <port>', 'Default port', '3000')
  .action(async (name, options) => {
    try {
      console.log(`🚀 Creating project "${name}"...`);
      const result = await scaffold.createProject(name, {
        description: options.description || '',
        port: parseInt(options.port, 10)
      });

      for (const step of result.steps) {
        const icon = step.status === 'ok' ? '✅' : '❌';
        console.log(`  ${icon} ${step.step}${step.error ? ': ' + step.error : ''}`);
      }

      console.log(`\n🖖 Project "${name}" created!`);
    } catch (err) {
      console.error(`Create failed: ${err.message}`);
      process.exit(1);
    }
  });

program
  .command('scaffold <repo>')
  .description('Set up a project for CommandDeck (legacy)')
  .action(async (repo) => {
    // Delegate to create command
    try {
      console.log(`🚀 Scaffolding project "${repo}"...`);
      const result = await scaffold.createProject(repo, {});

      for (const step of result.steps) {
        const icon = step.status === 'ok' ? '✅' : '❌';
        console.log(`  ${icon} ${step.step}${step.error ? ': ' + step.error : ''}`);
      }
    } catch (err) {
      console.error(`Scaffold failed: ${err.message}`);
      process.exit(1);
    }
  });

program.parse();
