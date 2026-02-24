'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

describe('pr', () => {
  it('should export expected functions', () => {
    const pr = require('../lib/pr');
    assert.equal(typeof pr.create, 'function');
    assert.equal(typeof pr.updateBody, 'function');
    assert.equal(typeof pr.checkStatus, 'function');
    assert.equal(typeof pr.cleanup, 'function');
  });

  it('should use temp file approach (no /dev/stdin references)', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(path.join(__dirname, '..', 'lib', 'pr.js'), 'utf-8');
    assert.ok(!source.includes('/dev/stdin'), 'pr.js should not reference /dev/stdin');
  });
});
