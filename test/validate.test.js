'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { assertSafeRef, validateRepoName } = require('../lib/validate');

describe('validate', () => {
  describe('assertSafeRef', () => {
    it('should accept valid git refs', () => {
      assert.doesNotThrow(() => assertSafeRef('main', 'branch'));
      assert.doesNotThrow(() => assertSafeRef('feature/my-branch', 'branch'));
      assert.doesNotThrow(() => assertSafeRef('commanddeck/mission-123/obj-1', 'branch'));
      assert.doesNotThrow(() => assertSafeRef('v1.0.0', 'tag'));
      assert.doesNotThrow(() => assertSafeRef('refs/heads/main', 'ref'));
    });

    it('should reject refs with spaces', () => {
      assert.throws(
        () => assertSafeRef('my branch', 'branch'),
        /Unsafe branch/
      );
    });

    it('should reject refs with shell metacharacters', () => {
      assert.throws(
        () => assertSafeRef('branch;rm -rf /', 'branch'),
        /Unsafe branch/
      );
      assert.throws(
        () => assertSafeRef('branch$(whoami)', 'branch'),
        /Unsafe branch/
      );
      assert.throws(
        () => assertSafeRef('branch`id`', 'branch'),
        /Unsafe branch/
      );
    });

    it('should reject empty refs', () => {
      assert.throws(
        () => assertSafeRef('', 'branch'),
        /Unsafe branch/
      );
    });
  });

  describe('validateRepoName', () => {
    it('should accept valid repo names', () => {
      assert.doesNotThrow(() => validateRepoName('my-repo'));
      assert.doesNotThrow(() => validateRepoName('CommandDeck'));
      assert.doesNotThrow(() => validateRepoName('repo_name'));
      assert.doesNotThrow(() => validateRepoName('repo.name'));
    });

    it('should reject empty repo names', () => {
      assert.throws(
        () => validateRepoName(''),
        /required/
      );
    });

    it('should reject non-string repo names', () => {
      assert.throws(
        () => validateRepoName(null),
        /required/
      );
      assert.throws(
        () => validateRepoName(undefined),
        /required/
      );
    });

    it('should reject repo names with slashes', () => {
      assert.throws(
        () => validateRepoName('org/repo'),
        /Invalid repository name/
      );
    });

    it('should reject repo names with special characters', () => {
      assert.throws(
        () => validateRepoName('repo;rm -rf /'),
        /Invalid repository name/
      );
      assert.throws(
        () => validateRepoName('repo name'),
        /Invalid repository name/
      );
    });
  });
});
