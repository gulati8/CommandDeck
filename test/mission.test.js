'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { shouldOpenPR } = require('../lib/mission');

test('shouldOpenPR only when mission is merging and all items are done', () => {
  assert.equal(
    shouldOpenPR({ status: 'merging', work_items: [{ status: 'done' }, { status: 'done' }] }),
    true
  );

  assert.equal(
    shouldOpenPR({ status: 'paused', work_items: [{ status: 'done' }] }),
    false
  );

  assert.equal(
    shouldOpenPR({ status: 'merging', work_items: [{ status: 'done' }, { status: 'ready' }] }),
    false
  );
});
