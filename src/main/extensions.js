'use strict';

const fs = require('fs');
const path = require('path');
const { extractCrx } = require('../lib/crx');

function extensionApi(ses) {
  if (ses.extensions && typeof ses.extensions.loadExtension === 'function') {
    return ses.extensions;
  }
  return ses;
}

async function loadUnpackedOnSession(ses, dir) {
  const abs = path.resolve(dir);
  const manifest = path.join(abs, 'manifest.json');
  if (!fs.existsSync(manifest)) {
    throw new Error('该目录没有 manifest.json，不是 unpacked 扩展');
  }
  const api = extensionApi(ses);
  return api.loadExtension(abs, { allowFileAccess: true });
}

async function removeFromSession(ses, id) {
  const api = extensionApi(ses);
  if (typeof api.removeExtension === 'function') {
    await api.removeExtension(id);
    return;
  }
  if (typeof ses.removeExtension === 'function') {
    ses.removeExtension(id);
  }
}

function listFromSession(ses) {
  const api = extensionApi(ses);
  if (typeof api.getAllExtensions === 'function') {
    return api.getAllExtensions();
  }
  if (typeof ses.getAllExtensions === 'function') {
    return ses.getAllExtensions();
  }
  return [];
}

async function importCrxToDir(crxPath, destRoot) {
  const base = path.basename(crxPath, path.extname(crxPath)).replace(/[^\w.-]+/g, '_') || 'crx';
  const dest = path.join(destRoot, `${base}-${Date.now()}`);
  extractCrx(crxPath, dest);
  return dest;
}

module.exports = {
  loadUnpackedOnSession,
  removeFromSession,
  listFromSession,
  importCrxToDir,
};
