'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const path = require('path');

// Isolate state dir
process.env.COMMANDDECK_STATE_DIR = path.join(os.tmpdir(), `commanddeck-risk-test-${Date.now()}`);

const risk = require('../lib/risk');

describe('risk', () => {
  describe('detectRiskFlags', () => {
    it('should detect ci-workflow flag', () => {
      const flags = risk.detectRiskFlags(['.github/workflows/ci.yml'], 'test-repo');
      assert.ok(flags.includes('ci-workflow'));
    });

    it('should detect auth flag', () => {
      const flags = risk.detectRiskFlags(['src/auth/login.js'], 'test-repo');
      assert.ok(flags.includes('auth'));
    });

    it('should detect infra flag', () => {
      const flags = risk.detectRiskFlags(['Dockerfile'], 'test-repo');
      assert.ok(flags.includes('infra'));
    });

    it('should detect dependency flag', () => {
      const flags = risk.detectRiskFlags(['package.json'], 'test-repo');
      assert.ok(flags.includes('dependency'));
    });

    it('should detect migration flag', () => {
      const flags = risk.detectRiskFlags(['db/migrate/001_create_users.rb'], 'test-repo');
      assert.ok(flags.includes('migration'));
    });

    it('should return empty for safe files', () => {
      const flags = risk.detectRiskFlags(['src/components/Button.tsx', 'src/utils/format.ts'], 'test-repo');
      assert.equal(flags.length, 0);
    });

    it('should detect multiple flags', () => {
      const flags = risk.detectRiskFlags([
        '.github/workflows/deploy.yml',
        'package.json',
        'src/auth/middleware.js'
      ], 'test-repo');

      assert.ok(flags.includes('ci-workflow'));
      assert.ok(flags.includes('dependency'));
      assert.ok(flags.includes('auth'));
    });
  });

  describe('detectRiskFlagsForObjective', () => {
    it('should detect flags from context_sources', () => {
      const objective = {
        title: 'Update button styles',
        description: 'Change CSS for the button component',
        context_sources: ['.github/workflows/test.yml']
      };

      const flags = risk.detectRiskFlagsForObjective(objective, 'test-repo');
      assert.ok(flags.includes('ci-workflow'));
    });

    it('should detect flags from keywords in title', () => {
      const objective = {
        title: 'Add JWT authentication to API',
        description: 'Implement token-based auth',
        context_sources: []
      };

      const flags = risk.detectRiskFlagsForObjective(objective, 'test-repo');
      assert.ok(flags.includes('auth'));
    });

    it('should detect migration keyword', () => {
      const objective = {
        title: 'Add migration for users table',
        description: 'Create a new schema migration',
        context_sources: []
      };

      const flags = risk.detectRiskFlagsForObjective(objective, 'test-repo');
      assert.ok(flags.includes('migration'));
    });

    it('should detect infra keywords', () => {
      const objective = {
        title: 'Set up Docker deployment',
        description: 'Configure kubernetes cluster',
        context_sources: []
      };

      const flags = risk.detectRiskFlagsForObjective(objective, 'test-repo');
      assert.ok(flags.includes('infra'));
    });
  });

  describe('getMandatoryReviewers', () => {
    it('should return worf for auth flags', () => {
      const reviewers = risk.getMandatoryReviewers(['auth']);
      assert.ok(reviewers.includes('worf'));
    });

    it('should return geordi for infra flags', () => {
      const reviewers = risk.getMandatoryReviewers(['infra']);
      assert.ok(reviewers.includes('geordi'));
    });

    it('should return human for migration flags', () => {
      const reviewers = risk.getMandatoryReviewers(['migration']);
      assert.ok(reviewers.includes('human'));
    });

    it('should return spock for dependency flags', () => {
      const reviewers = risk.getMandatoryReviewers(['dependency']);
      assert.ok(reviewers.includes('spock'));
    });

    it('should return multiple reviewers for multiple flags', () => {
      const reviewers = risk.getMandatoryReviewers(['auth', 'infra', 'dependency']);
      assert.ok(reviewers.includes('worf'));
      assert.ok(reviewers.includes('geordi'));
      assert.ok(reviewers.includes('spock'));
    });

    it('should deduplicate reviewers', () => {
      const reviewers = risk.getMandatoryReviewers(['auth', 'security']);
      // Both map to worf
      assert.equal(reviewers.filter(r => r === 'worf').length, 1);
    });
  });

});
