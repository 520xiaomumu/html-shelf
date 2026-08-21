'use strict';

const path = require('path');

function isPathInside(root, target) {
  const absRoot = path.resolve(root);
  const absTarget = path.resolve(target);
  const rel = path.relative(absRoot, absTarget);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

function resolveApprovedPath(approvedRoot, requestPath) {
  if (!approvedRoot) {
    return { ok: false, error: 'no-root' };
  }
  if (typeof requestPath !== 'string') {
    return { ok: false, error: 'bad-path' };
  }
  if (requestPath.includes('\0')) {
    return { ok: false, error: 'null-byte' };
  }
  const root = path.resolve(approvedRoot);
  let decoded;
  try {
    decoded = decodeURIComponent(requestPath).replace(/^\/+/, '');
  } catch {
    return { ok: false, error: 'bad-encoding' };
  }
  if (decoded === '') {
    return { ok: true, path: root, isDirectory: true };
  }
  if (path.isAbsolute(decoded) || /^[a-zA-Z]:[\\/]/.test(decoded)) {
    return { ok: false, error: 'absolute' };
  }
  const target = path.resolve(root, decoded);
  if (!isPathInside(root, target)) {
    return { ok: false, error: 'escape' };
  }
  return { ok: true, path: target, isDirectory: false };
}

function approvedRootForItem(item) {
  if (!item || !item.path) return null;
  if (item.kind === 'url') return null;
  if (item.kind === 'folder') return path.resolve(item.path);
  return path.resolve(path.dirname(item.path));
}

module.exports = {
  isPathInside,
  resolveApprovedPath,
  approvedRootForItem,
};
