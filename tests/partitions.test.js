'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  persistPartitionKey,
  partitionsShareStorage,
  itemIdFromPartitionKey,
  assertIsolated,
} = require('../src/lib/partitions');

describe('persist key isolation by item id', () => {
  it('binds a unique persist key to each item id', () => {
    const a = persistPartitionKey('item-aaa');
    const b = persistPartitionKey('item-bbb');
    assert.equal(a, 'persist:item-item-aaa');
    assert.equal(b, 'persist:item-item-bbb');
    assert.notEqual(a, b);
    assert.equal(partitionsShareStorage(a, b), false);
    assert.equal(itemIdFromPartitionKey(a), 'item-aaa');
    assertIsolated('item-aaa', 'item-bbb');
  });

  it('never uses a shared default session key for items', () => {
    const key = persistPartitionKey('abc-123');
    assert.notEqual(key, 'persist:default');
    assert.notEqual(key, '');
    assert.match(key, /^persist:item-/);
  });

  it('same id maps to the same key; empty id is rejected', () => {
    assert.equal(persistPartitionKey('same'), persistPartitionKey('same'));
    assert.throws(() => persistPartitionKey(''), /non-empty/);
    assert.throws(() => persistPartitionKey('../escape'), /invalid/);
  });
});
