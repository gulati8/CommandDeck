'use strict';

const fs = require('fs');
const path = require('path');

const { STATE_DIR } = require('./state');

// Default high-risk file patterns
const DEFAULT_PATTERNS = {
  'ci-workflow': ['.github/workflows/**'],
  'infra': ['infra/**', 'terraform/**', 'deploy/**', 'Dockerfile', 'docker-compose*.yml'],
  'migration': ['db/migrate/**', 'prisma/migrations/**', 'migrations/**'],
  'auth': ['**/auth/**', '**/security/**', '**/middleware/auth*'],
  'dependency': ['package.json', 'pnpm-lock.yaml', 'Gemfile', 'Gemfile.lock', 'requirements.txt', 'go.mod']
};

// Mandatory review mapping: risk flag → required reviewer
const MANDATORY_REVIEWS = {
  'auth': 'worf',
  'security': 'worf',
  'ci-workflow': 'geordi',
  'infra': 'geordi',
  'deploy': 'geordi',
  'migration': 'human',
  'dependency': 'spock'
};

// Load project-specific patterns, falling back to defaults
function loadPatterns(repo) {
  const configPath = path.join(STATE_DIR, 'projects', repo, 'config.json');

  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    return config.high_risk_patterns || DEFAULT_PATTERNS;
  } catch {
    return DEFAULT_PATTERNS;
  }
}

// Convert a glob pattern to a regex
function globToRegex(pattern) {
  let regex = pattern
    .replace(/\./g, '\\.')
    .replace(/\*\*/g, '{{GLOBSTAR}}')
    .replace(/\*/g, '[^/]*')
    .replace(/\{\{GLOBSTAR\}\}/g, '.*')
    .replace(/\?/g, '[^/]');
  return new RegExp(`^${regex}$`);
}

// Check if a file path matches any pattern in a category
function matchesCategory(filePath, patterns) {
  return patterns.some(pattern => {
    const regex = globToRegex(pattern);
    return regex.test(filePath);
  });
}

// Detect risk flags for a list of file paths
function detectRiskFlags(filePaths, repo) {
  const patterns = loadPatterns(repo);
  const flags = new Set();

  for (const filePath of filePaths) {
    for (const [category, categoryPatterns] of Object.entries(patterns)) {
      if (matchesCategory(filePath, categoryPatterns)) {
        flags.add(category);
      }
    }
  }

  return Array.from(flags);
}

// Detect risk flags for an objective based on its description and expected files
function detectRiskFlagsForObjective(objective, repo) {
  const patterns = loadPatterns(repo);
  const flags = new Set();

  // Check context_sources for risky file references
  const sources = objective.context_sources || [];
  for (const source of sources) {
    for (const [category, categoryPatterns] of Object.entries(patterns)) {
      if (matchesCategory(source, categoryPatterns)) {
        flags.add(category);
      }
    }
  }

  // Keyword matching on title/description for common risk indicators
  const text = `${objective.title || ''} ${objective.description || ''}`.toLowerCase();
  const keywordMap = {
    'auth': ['auth', 'login', 'oauth', 'jwt', 'session', 'password', 'credential'],
    'security': ['security', 'permission', 'rbac', 'acl', 'encrypt', 'secret'],
    'migration': ['migration', 'migrate', 'schema', 'alter table', 'add column'],
    'infra': ['docker', 'terraform', 'deploy', 'ci/cd', 'pipeline', 'kubernetes', 'k8s'],
    'dependency': ['dependency', 'upgrade', 'package', 'install']
  };

  for (const [category, keywords] of Object.entries(keywordMap)) {
    if (keywords.some(kw => text.includes(kw))) {
      flags.add(category);
    }
  }

  return Array.from(flags);
}

// Get mandatory reviewers for a set of risk flags
function getMandatoryReviewers(riskFlags) {
  const reviewers = new Set();

  for (const flag of riskFlags) {
    const reviewer = MANDATORY_REVIEWS[flag];
    if (reviewer) {
      reviewers.add(reviewer);
    }
  }

  return Array.from(reviewers);
}

module.exports = {
  DEFAULT_PATTERNS,
  MANDATORY_REVIEWS,
  loadPatterns,
  detectRiskFlags,
  detectRiskFlagsForObjective,
  getMandatoryReviewers
};
