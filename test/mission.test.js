'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { shouldOpenPR } = require('../lib/mission');

describe('shouldOpenPR', () => {
  it('should return true when mission is merging and all items are done', () => {
    assert.equal(
      shouldOpenPR({ status: 'merging', work_items: [{ status: 'done' }, { status: 'done' }] }),
      true
    );
  });

  it('should return false when mission is not merging', () => {
    assert.equal(
      shouldOpenPR({ status: 'paused', work_items: [{ status: 'done' }] }),
      false
    );
  });

  it('should return false when some items are not done', () => {
    assert.equal(
      shouldOpenPR({ status: 'merging', work_items: [{ status: 'done' }, { status: 'ready' }] }),
      false
    );
  });

  it('should return false for null state', () => {
    assert.equal(shouldOpenPR(null), false);
  });
});
