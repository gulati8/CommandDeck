'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const { assertSafeRef } = require('./validate');

const PROJECT_DIR = process.env.COMMANDDECK_PROJECT_DIR || path.join(process.env.HOME, 'projects');

// Get the full path to a project's main clone
function projectPath(repo) {
  return path.join(PROJECT_DIR, repo);
}

// Get the worktree path for a given worker index
function worktreePath(repo, workerIndex) {
  return `${projectPath(repo)}-wt-${workerIndex}`;
}

function runGit(cwd, args) {
  return execFileSync('git', args, { cwd, stdio: 'pipe', encoding: 'utf-8' });
}

// Create a worktree for a worker on a new branch
function create(repo, workerIndex, branch, baseBranch) {
  assertSafeRef(branch, 'branch');
  const mainDir = projectPath(repo);
  const wtPath = worktreePath(repo, workerIndex);

  // Remove existing worktree if present
  try {
    runGit(mainDir, ['worktree', 'remove', wtPath, '--force']);
  } catch {
    // Worktree didn't exist — fine
  }

  // Also clean up the directory if it's lingering
  if (fs.existsSync(wtPath)) {
    fs.rmSync(wtPath, { recursive: true, force: true });
  }

  // Fetch latest from remote
  try {
    runGit(mainDir, ['fetch', 'origin']);
  } catch {
    // Offline or no remote — continue with local state
  }

  // Delete the branch if it already exists locally (stale from previous run)
  try {
    runGit(mainDir, ['branch', '-D', branch]);
  } catch {
    // Branch didn't exist — fine
  }

  // Create worktree with new branch based on the specified or default branch
  const startPoint = baseBranch || getDefaultBranch(mainDir);
  runGit(mainDir, ['worktree', 'add', wtPath, '-b', branch, startPoint]);

  return wtPath;
}

// Remove a worktree
function remove(repo, workerIndex) {
  const mainDir = projectPath(repo);
  const wtPath = worktreePath(repo, workerIndex);

  try {
    runGit(mainDir, ['worktree', 'remove', wtPath, '--force']);
  } catch {
    // Already removed or doesn't exist
  }

  // Clean up directory if lingering
  if (fs.existsSync(wtPath)) {
    fs.rmSync(wtPath, { recursive: true, force: true });
  }
}

// List all active worktrees for a repo
function list(repo) {
  const mainDir = projectPath(repo);

  try {
    const output = runGit(mainDir, ['worktree', 'list', '--porcelain']);

    const worktrees = [];
    let current = {};

    for (const line of output.split('\n')) {
      if (line.startsWith('worktree ')) {
        if (current.path) worktrees.push(current);
        current = { path: line.replace('worktree ', '') };
      } else if (line.startsWith('HEAD ')) {
        current.head = line.replace('HEAD ', '');
      } else if (line.startsWith('branch ')) {
        current.branch = line.replace('branch refs/heads/', '');
      } else if (line === 'detached') {
        current.detached = true;
      }
    }
    if (current.path) worktrees.push(current);

    return worktrees;
  } catch {
    return [];
  }
}

// Remove all CommandDeck worktrees for a repo
function removeAll(repo) {
  const worktrees = list(repo);
  const mainDir = projectPath(repo);

  for (const wt of worktrees) {
    // Skip the main worktree
    if (wt.path === mainDir) continue;

    // Only remove CommandDeck worktrees (ending in -wt-N)
    if (/-wt-\d+$/.test(wt.path)) {
      try {
        runGit(mainDir, ['worktree', 'remove', wt.path, '--force']);
      } catch {
        // Force remove the directory
        if (fs.existsSync(wt.path)) {
          fs.rmSync(wt.path, { recursive: true, force: true });
        }
      }
    }
  }

  // Prune stale worktree references
  try {
    runGit(mainDir, ['worktree', 'prune']);
  } catch {
    // Ignore
  }
}

// Get the default branch for a repo (main or master)
function getDefaultBranch(projectDir) {
  try {
    const ref = runGit(projectDir, ['symbolic-ref', 'refs/remotes/origin/HEAD']).trim();
    return ref.replace('refs/remotes/origin/', '');
  } catch {
    // Fallback: check if main exists, otherwise use master
    try {
      runGit(projectDir, ['rev-parse', '--verify', 'main']);
      return 'main';
    } catch {
      return 'master';
    }
  }
}

module.exports = {
  PROJECT_DIR,
  projectPath,
  worktreePath,
  create,
  remove,
  list,
  removeAll,
  getDefaultBranch
};
