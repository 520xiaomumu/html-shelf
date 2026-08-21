'use strict';

const path = require('path');
const { persistPartitionKey, BROWSER_PARTITION } = require('../lib/partitions');

function itemUrl(item) {
  if (!item) throw new Error('item required');
  if (item.kind === 'url') return item.path;
  const base = path.basename(item.path);
  return `htmlshelf://${item.id}/${encodeURIComponent(base)}`;
}

function itemPartition(item) {
  if (!item) throw new Error('item required');
  if (item.kind === 'url') return BROWSER_PARTITION;
  return persistPartitionKey(item.id);
}

module.exports = { itemUrl, itemPartition };
