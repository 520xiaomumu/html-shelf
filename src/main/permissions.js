'use strict';

const { dialog, BrowserWindow } = require('electron');

const MEDIA_PERMS = new Set(['media', 'mediaKeySystem']);
const ALWAYS_ALLOW = new Set(['fullscreen', 'pointerLock', 'clipboard-sanitized-write']);

function permissionKey(webContents, details) {
  try {
    const url = new URL(details?.requestingUrl || webContents.getURL() || 'about:blank');
    if (url.protocol === 'htmlshelf:') return `item:${url.hostname}`;
    return url.origin;
  } catch {
    return 'unknown';
  }
}

function attachPermissionHandlers(ses, store) {
  if (ses._htmlshelfPerms) return;
  ses._htmlshelfPerms = true;

  ses.setPermissionCheckHandler((_wc, permission) => {
    if (ALWAYS_ALLOW.has(permission) || MEDIA_PERMS.has(permission)) return true;
    return false;
  });

  ses.setPermissionRequestHandler(async (webContents, permission, callback, details) => {
    if (ALWAYS_ALLOW.has(permission)) {
      callback(true);
      return;
    }
    if (!MEDIA_PERMS.has(permission)) {
      callback(false);
      return;
    }

    const key = permissionKey(webContents, details);
    const remembered = store.getState().permissions[key] || {};
    if (remembered.media === true) {
      callback(true);
      return;
    }
    if (remembered.media === false) {
      callback(false);
      return;
    }

    const types = (details && details.mediaTypes) || [];
    const wantsVideo = types.includes('video') || types.length === 0;
    const wantsAudio = types.includes('audio') || types.length === 0;
    const parts = [];
    if (wantsVideo) parts.push('摄像头');
    if (wantsAudio) parts.push('麦克风');
    const label = parts.join('和') || '摄像头/麦克风';

    const parent = BrowserWindow.fromWebContents(webContents);
    const result = await dialog.showMessageBox(parent || undefined, {
      type: 'question',
      buttons: ['允许', '拒绝'],
      defaultId: 0,
      cancelId: 1,
      title: '媒体权限',
      message: `该页面申请使用${label}`,
      detail: '允许后，若本机没有摄像头或麦克风，页面应显示明确失败原因，而不会白屏。页架不自研通话信令。',
    });
    const allow = result.response === 0;
    store.setPermission(key, 'media', allow);
    callback(allow);
  });
}

module.exports = { attachPermissionHandlers, permissionKey };
