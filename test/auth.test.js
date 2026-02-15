'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const auth = require('../lib/auth');

describe('auth', () => {
  describe('detectAuthUrl', () => {
    it('should detect OAuth URL from stderr', () => {
      const stderr = 'Error: Please authenticate at https://console.anthropic.com/oauth/login?code=abc123';
      const url = auth.detectAuthUrl(stderr);
      assert.ok(url);
      assert.ok(url.includes('console.anthropic.com'));
    });

    it('should detect generic OAuth URL', () => {
      const stderr = 'Visit https://example.com/oauth/authorize to authenticate';
      const url = auth.detectAuthUrl(stderr);
      assert.ok(url);
      assert.ok(url.includes('oauth'));
    });

    it('should return null for stderr without auth URL', () => {
      const url = auth.detectAuthUrl('Some other error occurred');
      assert.equal(url, null);
    });

    it('should return null for empty/null stderr', () => {
      assert.equal(auth.detectAuthUrl(null), null);
      assert.equal(auth.detectAuthUrl(''), null);
    });
  });

  describe('isAuthFailure', () => {
    it('should detect unauthorized errors', () => {
      assert.equal(auth.isAuthFailure('Error: Unauthorized access'), true);
    });

    it('should detect authentication required errors', () => {
      assert.equal(auth.isAuthFailure('Authentication required to continue'), true);
    });

    it('should detect API key errors', () => {
      assert.equal(auth.isAuthFailure('Invalid API key provided'), true);
    });

    it('should detect expired token errors', () => {
      assert.equal(auth.isAuthFailure('Your token has expired'), true);
    });

    it('should return false for non-auth errors', () => {
      assert.equal(auth.isAuthFailure('File not found'), false);
    });

    it('should return false for null/empty', () => {
      assert.equal(auth.isAuthFailure(null), false);
      assert.equal(auth.isAuthFailure(''), false);
    });
  });

  describe('checkAuth', () => {
    it('should return an object with authenticated and version fields', () => {
      const result = auth.checkAuth();
      assert.equal(typeof result.authenticated, 'boolean');
      // version may be null if not authenticated
    });
  });

  describe('brokerAuth', () => {
    it('should post auth message to reporter', async () => {
      const messages = [];
      const reporter = { post: async (msg) => messages.push(msg) };

      await auth.brokerAuth(reporter, 'https://example.com/oauth');
      assert.equal(messages.length, 1);
      assert.ok(messages[0].includes('authentication required'));
      assert.ok(messages[0].includes('https://example.com/oauth'));
    });

    it('should post generic message when no URL', async () => {
      const messages = [];
      const reporter = { post: async (msg) => messages.push(msg) };

      await auth.brokerAuth(reporter, null);
      assert.equal(messages.length, 1);
      assert.ok(messages[0].includes('authentication required'));
    });

    it('should fall back to console when no reporter', async () => {
      // Should not throw
      await auth.brokerAuth(null, 'https://example.com/oauth');
    });
  });
});
