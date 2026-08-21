'use strict';

const ITEM_PREFIX = 'persist:item-';
const BROWSER_PARTITION = 'persist:browser';

function persistPartitionKey(itemId) {
  if (typeof itemId !== 'string' || itemId.trim() === '') {
    throw new Error('persist partition requires a non-empty item id');
  }
  const id = itemId.trim();
  if (id.includes('/') || id.includes('\\') || id.includes('..') || /\s/.test(id)) {
    throw new Error('invalid item id for persist partition');
  }
  return `${ITEM_PREFIX}${id}`;
}

function isItemPartitionKey(key) {
  return typeof key === 'string' && key.startsWith(ITEM_PREFIX) && key.length > ITEM_PREFIX.length;
}

function itemIdFromPartitionKey(key) {
  if (!isItemPartitionKey(key)) return null;
  return key.slice(ITEM_PREFIX.length);
}

function partitionsShareStorage(keyA, keyB) {
  return keyA === keyB;
}

function assertIsolated(itemIdA, itemIdB) {
  const a = persistPartitionKey(itemIdA);
  const b = persistPartitionKey(itemIdB);
  if (itemIdA !== itemIdB && partitionsShareStorage(a, b)) {
    throw new Error('different item ids must not share a persist key');
  }
  return { a, b };
}

module.exports = {
  ITEM_PREFIX,
  BROWSER_PARTITION,
  persistPartitionKey,
  isItemPartitionKey,
  itemIdFromPartitionKey,
  partitionsShareStorage,
  assertIsolated,
};
