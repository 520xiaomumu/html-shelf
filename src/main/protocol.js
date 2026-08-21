'use strict';

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { net } = require('electron');
const { approvedRootForItem, resolveApprovedPath, isPathInside } = require('../lib/path-guard');
const { mimeFor } = require('../lib/mime');

function registerPrivilegedSchemes(protocol) {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'htmlshelf',
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        stream: true,
        corsEnabled: true,
      },
    },
    {
      scheme: 'shelfmedia',
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        stream: true,
        corsEnabled: true,
      },
    },
  ]);
}

function attachProtocols(ses, { getItem, getCoverPath }) {
  if (ses._htmlshelfProtocols) return;
  ses._htmlshelfProtocols = true;

  ses.protocol.handle('htmlshelf', async (request) => {
    try {
      const url = new URL(request.url);
      const item = getItem(url.hostname);
      if (!item || item.kind === 'url') {
        return new Response('Not Found', { status: 404 });
      }
      const root = approvedRootForItem(item);
      const resolved = resolveApprovedPath(root, url.pathname);
      if (!resolved.ok) {
        return new Response('Forbidden', { status: 403 });
      }
      let filePath = resolved.path;
      if (resolved.isDirectory) {
        filePath = item.path;
      }
      if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        return new Response('Not Found', { status: 404 });
      }
      if (!isPathInside(root, filePath)) {
        return new Response('Forbidden', { status: 403 });
      }
      try {
        const fetched = await net.fetch(pathToFileURL(filePath).href, {
          bypassCustomProtocolHandlers: true,
        });
        const headers = new Headers(fetched.headers);
        headers.set('Content-Type', mimeFor(filePath));
        headers.set('Cache-Control', 'no-cache');
        return new Response(fetched.body, { status: fetched.status, headers });
      } catch {
        const data = fs.readFileSync(filePath);
        return new Response(data, {
          status: 200,
          headers: { 'Content-Type': mimeFor(filePath), 'Cache-Control': 'no-cache' },
        });
      }
    } catch {
      return new Response('Not Found', { status: 404 });
    }
  });

  ses.protocol.handle('shelfmedia', async (request) => {
    try {
      const url = new URL(request.url);
      if (url.hostname !== 'cover') {
        return new Response('Not Found', { status: 404 });
      }
      const itemId = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
      const coverPath = getCoverPath(itemId);
      if (!coverPath || !fs.existsSync(coverPath) || !fs.statSync(coverPath).isFile()) {
        return new Response('Not Found', { status: 404 });
      }
      const fetched = await net.fetch(pathToFileURL(path.resolve(coverPath)).href, {
        bypassCustomProtocolHandlers: true,
      });
      const headers = new Headers(fetched.headers);
      headers.set('Content-Type', mimeFor(coverPath));
      return new Response(fetched.body, { status: fetched.status, headers });
    } catch {
      return new Response('Not Found', { status: 404 });
    }
  });
}

module.exports = { registerPrivilegedSchemes, attachProtocols };
