'use strict';

const { spawn, execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const { logEvent } = require('./observability');
const auth = require('./auth');

const WORKER_TIMEOUT = parseInt(process.env.COMMANDDECK_WORKER_TIMEOUT || '2700000', 10); // 45 min default
const DEFAULT_MODEL = process.env.COMMANDDECK_MODEL || 'claude-opus-4-6';

// Lazily check that claude CLI is on PATH (checked once per process)
let _claudeChecked = false;
function ensureClaude() {
  if (_claudeChecked) return;
  try {
    execFileSync('which', ['claude'], { stdio: 'pipe' });
    _claudeChecked = true;
  } catch {
    throw new Error(
      'Claude Code CLI not found on PATH. Install it with: npm install -g @anthropic-ai/claude-code'
    );
  }
}

// Spawn a claude -p worker for an objective in a worktree
function execute(worktreePath, objective, mission, { model, onStdout, onStderr } = {}) {
  ensureClaude();
  const stateDir = path.join(
    process.env.COMMANDDECK_STATE_DIR || path.join(process.env.HOME, '.commanddeck'),
    'projects', mission.repo, 'missions', mission.mission_id
  );

  const prompt = [
    `You are ${objective.assigned_to}, executing objective ${objective.id}: ${objective.title}`,
    ``,
    `Description: ${objective.description}`,
    ``,
    `Mission: ${mission.description}`,
    `Mission state directory: ${stateDir}`,
    ``,
    `Read ${stateDir}/mission.json for full mission context.`,
    objective.context_sources?.length
      ? `Read these briefings before starting:\n${objective.context_sources.map(s => `  - ${s}`).join('\n')}`
      : '',
    ``,
    `When done:`,
    `1. Commit your work with descriptive messages`,
    `2. Write evidence bundle to ${stateDir}/artifacts/evidence-${objective.id}.json`,
    `3. Write briefing to ${stateDir}/briefings/${objective.assigned_to}-output-${objective.id}.json`,
  ].filter(Boolean).join('\n');

  const agentModel = model || getModelForAgent(objective.assigned_to, mission) || DEFAULT_MODEL;

  return new Promise((resolve, reject) => {
    const proc = spawn('claude', [
      '-p', prompt,
      '--allowedTools', 'Read,Write,Edit,Bash,Glob,Grep',
      '--dangerously-skip-permissions',
      '--model', agentModel
    ], {
      cwd: worktreePath,
      env: {
        ...process.env,
        COMMANDDECK_AGENT: objective.assigned_to,
        COMMANDDECK_MISSION_ID: mission.mission_id
      },
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: WORKER_TIMEOUT
    });

    // Close stdin immediately so claude doesn't wait for input
    proc.stdin.end();

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      const chunk = data.toString();
      stdout += chunk;
      if (onStdout) onStdout(chunk);
      streamLog(objective.assigned_to, objective.id, 'out', chunk);
    });

    proc.stderr.on('data', (data) => {
      const chunk = data.toString();
      stderr += chunk;
      if (onStderr) onStderr(chunk);
      streamLog(objective.assigned_to, objective.id, 'err', chunk);
    });

    proc.on('close', (code) => {
      if (stderr.trim()) {
        persistWorkerStderr(mission, objective.id, stderr);
      }
      const authFailure = auth.isAuthFailure(stderr);
      const authUrl = authFailure ? auth.detectAuthUrl(stderr) : null;

      logEvent('worker.exit', {
        mission_id: mission.mission_id,
        repo: mission.repo,
        objective_id: objective.id,
        status: code === 0 ? 'ok' : (authFailure ? 'auth_failure' : 'error'),
        message: stderr.slice(-300)
      });
      resolve({
        code,
        stdout,
        stderr,
        objective: objective.id,
        success: code === 0,
        authFailure,
        authUrl
      });
    });

    proc.on('error', (err) => {
      reject(new Error(`Worker for ${objective.id} failed to spawn: ${err.message}`));
    });

    // Store reference for kill capability
    proc._objectiveId = objective.id;
    execute._activeWorkers = execute._activeWorkers || new Map();
    execute._activeWorkers.set(objective.id, proc);

    proc.on('close', () => {
      execute._activeWorkers.delete(objective.id);
    });
  });
}

// Execute a specialist subagent (Scotty, Worf, Spock, etc.) via claude -p
function executeSpecialist(projectDir, agent, prompt, mission, { model } = {}) {
  ensureClaude();
  const stateDir = path.join(
    process.env.COMMANDDECK_STATE_DIR || path.join(process.env.HOME, '.commanddeck'),
    'projects', mission.repo, 'missions', mission.mission_id
  );

  const fullPrompt = [
    `You are ${agent}. ${prompt}`,
    ``,
    `Mission state directory: ${stateDir}`,
    `Read ${stateDir}/mission.json for full mission context.`,
  ].join('\n');

  const agentModel = model || getModelForAgent(agent, mission) || DEFAULT_MODEL;

  return new Promise((resolve, reject) => {
    const proc = spawn('claude', [
      '-p', fullPrompt,
      '--dangerously-skip-permissions',
      '--model', agentModel
    ], {
      cwd: projectDir,
      env: {
        ...process.env,
        COMMANDDECK_AGENT: agent,
        COMMANDDECK_MISSION_ID: mission.mission_id
      },
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: WORKER_TIMEOUT
    });

    // Close stdin immediately so claude doesn't wait for input
    proc.stdin.end();

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      const chunk = data.toString();
      stdout += chunk;
      streamLog(agent, 'specialist', 'out', chunk);
    });
    proc.stderr.on('data', (data) => {
      const chunk = data.toString();
      stderr += chunk;
      streamLog(agent, 'specialist', 'err', chunk);
    });

    proc.on('close', (code) => {
      if (stderr.trim()) {
        persistWorkerStderr(mission, `${agent}-specialist`, stderr);
      }
      resolve({ code, stdout, stderr, agent, success: code === 0 });
    });

    proc.on('error', (err) => {
      reject(new Error(`Specialist ${agent} failed to spawn: ${err.message}`));
    });
  });
}

// Kill a running worker by objective ID
function kill(objectiveId) {
  const workers = execute._activeWorkers;
  if (!workers) return false;

  const proc = workers.get(objectiveId);
  if (!proc) return false;

  proc.kill('SIGTERM');
  // Force kill after 10 seconds if still alive
  setTimeout(() => {
    try { proc.kill('SIGKILL'); } catch { /* already dead */ }
  }, 10000);

  return true;
}

// Get model for an agent from mission config or project config
function getModelForAgent(agentName, mission) {
  // Check project config for model overrides
  const configPath = path.join(
    process.env.COMMANDDECK_STATE_DIR || path.join(process.env.HOME, '.commanddeck'),
    'projects', mission.repo, 'config.json'
  );

  try {
    const config = JSON.parse(require('fs').readFileSync(configPath, 'utf-8'));
    if (config.model_overrides?.[agentName]) {
      return config.model_overrides[agentName];
    }
  } catch {
    // No config or no overrides
  }

  // Default model tiers
  const opusAgents = ['captain-picard', 'scotty'];
  if (opusAgents.includes(agentName)) {
    return 'claude-opus-4-6';
  }

  return DEFAULT_MODEL;
}

// Get count of active workers
function activeCount() {
  return execute._activeWorkers?.size || 0;
}

// Stream worker output to container logs in real time
function streamLog(agent, objectiveId, stream, chunk) {
  const lines = chunk.split('\n').filter(l => l.trim());
  for (const line of lines) {
    const prefix = `[${agent}/${objectiveId}]`;
    if (stream === 'err') {
      process.stderr.write(`${prefix} ${line}\n`);
    } else {
      process.stdout.write(`${prefix} ${line}\n`);
    }
  }
}

function persistWorkerStderr(mission, objectiveId, stderr) {
  const dir = path.join(
    process.env.COMMANDDECK_STATE_DIR || path.join(process.env.HOME, '.commanddeck'),
    'projects',
    mission.repo,
    'missions',
    mission.mission_id,
    'artifacts'
  );
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `worker-stderr-${objectiveId}.log`);
  fs.appendFileSync(filePath, `${new Date().toISOString()}\n${stderr}\n\n`, 'utf-8');
}

module.exports = {
  execute,
  executeSpecialist,
  kill,
  activeCount,
  ensureClaude,
  _resetClaudeCheck: () => { _claudeChecked = false; },
  WORKER_TIMEOUT
};
