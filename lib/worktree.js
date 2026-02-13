'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PROJECT_DIR = process.env.COMMANDDECK_PROJECT_DIR || path.join(process.env.HOME, 'projects');

// Get the full path to a project's main clone
function projectPath(repo) {
  return path.join(PROJECT_DIR, repo);
}

// Get the worktree path for a given worker index
function worktreePath(repo, workerIndex) {
  return `${projectPath(repo)}-wt-${workerIndex}`;
}

// Create a worktree for a worker on a new branch
function create(repo, workerIndex, branch) {
  const mainDir = projectPath(repo);
  const wtPath = worktreePath(repo, workerIndex);

  // Remove existing worktree if present
  try {
    execSync(`git worktree remove "${wtPath}" --force 2>/dev/null`, {
      cwd: mainDir,
      stdio: 'pipe'
    });
  } catch {
    // Worktree didn't exist — fine
  }

  // Also clean up the directory if it's lingering
  if (fs.existsSync(wtPath)) {
    fs.rmSync(wtPath, { recursive: true, force: true });
  }

  // Fetch latest from remote
  try {
    execSync('git fetch origin', { cwd: mainDir, stdio: 'pipe' });
  } catch {
    // Offline or no remote — continue with local state
  }

  // Delete the branch if it already exists locally (stale from previous run)
  try {
    execSync(`git branch -D "${branch}" 2>/dev/null`, { cwd: mainDir, stdio: 'pipe' });
  } catch {
    // Branch didn't exist — fine
  }

  // Create worktree with new branch based on the default branch
  const defaultBranch = getDefaultBranch(mainDir);
  execSync(`git worktree add "${wtPath}" -b "${branch}" "${defaultBranch}"`, {
    cwd: mainDir,
    stdio: 'pipe'
  });

  return wtPath;
}

// Remove a worktree
function remove(repo, workerIndex) {
  const mainDir = projectPath(repo);
  const wtPath = worktreePath(repo, workerIndex);

  try {
    execSync(`git worktree remove "${wtPath}" --force`, {
      cwd: mainDir,
      stdio: 'pipe'
    });
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
    const output = execSync('git worktree list --porcelain', {
      cwd: mainDir,
      encoding: 'utf-8'
    });

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
        execSync(`git worktree remove "${wt.path}" --force`, {
          cwd: mainDir,
          stdio: 'pipe'
        });
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
    execSync('git worktree prune', { cwd: mainDir, stdio: 'pipe' });
  } catch {
    // Ignore
  }
}

// Get the default branch for a repo (main or master)
function getDefaultBranch(projectDir) {
  try {
    const ref = execSync('git symbolic-ref refs/remotes/origin/HEAD', {
      cwd: projectDir,
      encoding: 'utf-8'
    }).trim();
    return ref.replace('refs/remotes/origin/', '');
  } catch {
    // Fallback: check if main exists, otherwise use master
    try {
      execSync('git rev-parse --verify main', { cwd: projectDir, stdio: 'pipe' });
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
