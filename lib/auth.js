'use strict';

const { execFileSync } = require('child_process');
const { logEvent } = require('./observability');

// Check if Claude Code CLI is authenticated
function checkAuth() {
  try {
    const output = execFileSync('claude', ['--version'], {
      stdio: 'pipe',
      encoding: 'utf-8',
      timeout: 10000
    });
    return { authenticated: true, version: output.trim() };
  } catch {
    return { authenticated: false, version: null };
  }
}

// Detect OAuth URL from worker stderr output
function detectAuthUrl(stderr) {
  if (!stderr) return null;
  // Claude Code outputs OAuth URLs when auth is needed
  const urlMatch = stderr.match(/(https:\/\/[^\s]*oauth[^\s]*)/i)
    || stderr.match(/(https:\/\/console\.anthropic\.com[^\s]*)/i)
    || stderr.match(/(https:\/\/[^\s]*login[^\s]*)/i);
  return urlMatch ? urlMatch[1] : null;
}

// Check if stderr indicates an auth failure
function isAuthFailure(stderr) {
  if (!stderr) return false;
  const authPatterns = [
    /unauthorized/i,
    /authentication required/i,
    /not authenticated/i,
    /api key/i,
    /invalid.*token/i,
    /expired.*token/i,
    /token.*expired/i,
    /login required/i
  ];
  return authPatterns.some(p => p.test(stderr));
}

// Post auth instructions to Slack
async function brokerAuth(reporter, authUrl) {
  const message = [
    '🔐 Claude Code authentication required.',
    '',
    authUrl
      ? `Open this URL to authenticate:\n${authUrl}`
      : 'Claude Code needs to be authenticated. Run `claude` interactively inside the container to complete OAuth.',
    '',
    'After authenticating, CommandDeck will automatically resume operations.'
  ].join('\n');

  logEvent('auth.required', { has_url: !!authUrl });

  if (reporter) {
    await reporter.post(message);
  } else {
    console.log(message);
  }
}

// Startup auth check — verifies Claude CLI is reachable
async function startupCheck(reporter) {
  const result = checkAuth();
  if (result.authenticated) {
    logEvent('auth.ok', { version: result.version });
    return true;
  }

  await brokerAuth(reporter);
  return false;
}

module.exports = {
  checkAuth,
  detectAuthUrl,
  isAuthFailure,
  brokerAuth,
  startupCheck
};
