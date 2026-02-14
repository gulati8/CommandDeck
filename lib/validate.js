'use strict';

function assertSafeRef(value, fieldName) {
  if (!/^[A-Za-z0-9._/-]+$/.test(value)) {
    throw new Error(`Unsafe ${fieldName}: ${value}`);
  }
}

function validateRepoName(repo) {
  if (typeof repo !== 'string' || repo.length === 0) {
    throw new Error('Repository name is required');
  }
  if (!/^[A-Za-z0-9._-]+$/.test(repo)) {
    throw new Error(`Invalid repository name: ${repo}`);
  }
}

module.exports = {
  assertSafeRef,
  validateRepoName
};
