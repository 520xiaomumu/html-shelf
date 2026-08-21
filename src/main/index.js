'use strict';

const path = require('path');
const fs = require('fs');
const { app, BrowserWindow, ipcMain, dialog, session, protocol, Menu, shell } = require('electron');
const { LibraryStore } = require('../lib/library-store');
const { persistPartitionKey, BROWSER_PARTITION } = require('../lib/partitions');
const { registerPrivilegedSchemes, attachProtocols } = require('./protocol');
const { attachPermissionHandlers } = require('./permissions');
const {
  loadUnpackedOnSession,
  removeFromSession,
  listFromSession,
  importCrxToDir,
} = require('./extensions');
const { itemUrl, itemPartition } = require('./item-url');

registerPrivilegedSchemes(protocol);

app.setName('html-shelf');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

let store;
let mainWindow = null;
const appWindows = new Map();

function userDataPath(...parts) {
  return path.join(app.getPath('userData'), ...parts);
}

function getItem(id) {
  return store.findItem(id);
}

function getCoverPath(itemId) {
  const item = store.findItem(itemId);
  return item && item.coverPath ? item.coverPath : null;
}

function hardenSession(ses) {
  attachProtocols(ses, { getItem, getCoverPath });
  attachPermissionHandlers(ses, store);
  if (ses !== session.defaultSession) {
    ses.webRequest.onBeforeRequest({ urls: ['file://*/*'] }, (_details, cb) => {
      cb({ cancel: true });
    });
  }
  ses.setWindowOpenHandler(({ url }) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('ui:open-tab', {
        url,
        partition: BROWSER_PARTITION,
        title: url,
      });
      mainWindow.show();
    }
    return { action: 'deny' };
  });
}

function createMainWindow() {
  const win = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 860,
    minHeight: 560,
    show: false,
    backgroundColor: '#efe4d3',
    title: '页架',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/shell.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webviewTag: true,
      spellcheck: false,
    },
  });
  win.once('ready-to-show', () => win.show());
  win.loadFile(path.join(__dirname, '../renderer/shell.html'));
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null;
  });
  return win;
}

function createAppWindow(item) {
  const existing = appWindows.get(item.id);
  if (existing && !existing.isDestroyed()) {
    existing.focus();
    return existing;
  }
  const win = new BrowserWindow({
    width: 980,
    height: 720,
    minWidth: 640,
    minHeight: 480,
    show: false,
    backgroundColor: '#efe4d3',
    title: item.title || '页架应用',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/app-chrome.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webviewTag: true,
      spellcheck: false,
    },
  });
  win.once('ready-to-show', () => win.show());
  win.loadFile(path.join(__dirname, '../renderer/app-chrome.html'), {
    query: {
      itemId: item.id,
      url: itemUrl(item),
      partition: itemPartition(item),
      title: item.title || '',
    },
  });
  win.on('closed', () => appWindows.delete(item.id));
  appWindows.set(item.id, win);
  return win;
}

function sendState() {
  const state = store.getState();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('library:changed', state);
  }
}

function bindIpc() {
  ipcMain.handle('library:get', () => store.getState());

  ipcMain.handle('library:addFiles', (_e, filePaths) => {
    const items = store.addFiles(filePaths);
    sendState();
    return items;
  });

  ipcMain.handle('library:addFolder', (_e, dirPath) => {
    const result = store.addFolder(dirPath);
    sendState();
    return result;
  });

  ipcMain.handle('library:addDropped', (_e, paths) => {
    const added = [];
    for (const p of paths || []) {
      let st;
      try {
        st = fs.statSync(p);
      } catch {
        continue;
      }
      try {
        if (st.isDirectory()) {
          added.push(...store.addFolder(p).files);
        } else if (st.isFile()) {
          added.push(store.addFile(p));
        }
      } catch {
        // skip non-html or unreadable paths
      }
    }
    sendState();
    return added;
  });

  ipcMain.handle('library:addUrl', (_e, url) => {
    const item = store.addUrl(url);
    sendState();
    return item;
  });

  ipcMain.handle('library:updateItem', (_e, id, patch) => {
    const item = store.updateItem(id, patch);
    sendState();
    return item;
  });

  ipcMain.handle('library:removeItem', (_e, id) => {
    store.removeItem(id);
    sendState();
    return true;
  });

  ipcMain.handle('library:addCategory', (_e, { name, parentId }) => {
    const cat = store.addCategory(name, parentId);
    sendState();
    return cat;
  });

  ipcMain.handle('library:updateCategory', (_e, id, patch) => {
    const cat = store.updateCategory(id, patch);
    sendState();
    return cat;
  });

  ipcMain.handle('library:removeCategory', (_e, id) => {
    store.removeCategory(id);
    sendState();
    return true;
  });

  ipcMain.handle('library:setSort', (_e, sort) => {
    store.setSort(sort);
    sendState();
    return store.getState();
  });

  ipcMain.handle('library:openItem', (_e, id) => {
    const item = store.findItem(id);
    if (!item) throw new Error('条目不存在');
    store.touchLastOpened(id);
    sendState();
    if (item.openMode === 'tab' || item.kind === 'url') {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('ui:open-tab', {
          url: itemUrl(item),
          partition: itemPartition(item),
          title: item.title,
          itemId: item.id,
        });
        mainWindow.show();
      }
      return { mode: 'tab' };
    }
    createAppWindow(item);
    return { mode: 'app' };
  });

  ipcMain.handle('dialog:pickFiles', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    const result = await dialog.showOpenDialog(win || undefined, {
      title: '添加 HTML 文件',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'HTML', extensions: ['html', 'htm'] }],
    });
    if (result.canceled) return [];
    const items = store.addFiles(result.filePaths);
    sendState();
    return items;
  });

  ipcMain.handle('dialog:pickFolder', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    const result = await dialog.showOpenDialog(win || undefined, {
      title: '添加文件夹（扫描 .html / .htm）',
      properties: ['openDirectory'],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    const added = store.addFolder(result.filePaths[0]);
    sendState();
    return added;
  });

  ipcMain.handle('dialog:pickCover', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    const result = await dialog.showOpenDialog(win || undefined, {
      title: '选择封面图',
      properties: ['openFile'],
      filters: [{ name: '图片', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'] }],
    });
    if (result.canceled) return null;
    return result.filePaths[0] || null;
  });

  ipcMain.handle('dialog:pickUnpacked', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    const result = await dialog.showOpenDialog(win || undefined, {
      title: '加载 unpacked 扩展目录',
      properties: ['openDirectory'],
    });
    if (result.canceled) return null;
    return result.filePaths[0] || null;
  });

  ipcMain.handle('dialog:pickCrx', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    const result = await dialog.showOpenDialog(win || undefined, {
      title: '导入 .crx 扩展',
      properties: ['openFile'],
      filters: [{ name: 'Chrome 扩展', extensions: ['crx'] }],
    });
    if (result.canceled) return null;
    return result.filePaths[0] || null;
  });

  ipcMain.handle('browser:openUrl', (_e, url) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('ui:open-tab', {
        url,
        partition: BROWSER_PARTITION,
        title: url,
      });
      mainWindow.show();
    }
    return true;
  });

  ipcMain.handle('browser:home', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('ui:view', 'library');
      mainWindow.show();
      mainWindow.focus();
    }
    return true;
  });

  ipcMain.handle('window:toggleFullscreen', (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (!win) return false;
    win.setFullScreen(!win.isFullScreen());
    return win.isFullScreen();
  });

  ipcMain.handle('window:isFullscreen', (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    return Boolean(win && win.isFullScreen());
  });

  ipcMain.handle('settings:get', () => ({
    userData: app.getPath('userData'),
    libraryFile: store.filePath,
    storeGap: 'Chrome 网上应用店一键安装属于 v2。当前 Electron 无法从商店直接安装扩展，请用本机 unpacked 目录或导入 .crx。',
  }));

  ipcMain.handle('settings:openLibraryDir', async () => {
    const dir = path.dirname(store.filePath);
    fs.mkdirSync(dir, { recursive: true });
    await shell.openPath(dir);
    return dir;
  });

  ipcMain.handle('extensions:list', async () => {
    const ses = session.fromPartition(BROWSER_PARTITION);
    let loaded = [];
    try {
      loaded = listFromSession(ses) || [];
    } catch {
      loaded = [];
    }
    const loadedById = new Map((loaded || []).map((e) => [e.id, e]));
    return store.getState().extensions.map((ext) => ({
      ...ext,
      runtimeLoaded: loadedById.has(ext.id),
    }));
  });

  ipcMain.handle('extensions:loadUnpacked', async (_e, dir) => {
    const ses = session.fromPartition(BROWSER_PARTITION);
    const info = await loadUnpackedOnSession(ses, dir);
    const row = store.upsertExtension({
      id: info.id,
      name: info.name || path.basename(dir),
      sourcePath: path.resolve(dir),
      unpackedPath: path.resolve(dir),
      enabled: true,
      kind: 'unpacked',
    });
    sendState();
    return row;
  });

  ipcMain.handle('extensions:importCrx', async (_e, crxPath) => {
    const dest = await importCrxToDir(crxPath, userDataPath('imported-crx'));
    const ses = session.fromPartition(BROWSER_PARTITION);
    const info = await loadUnpackedOnSession(ses, dest);
    const row = store.upsertExtension({
      id: info.id,
      name: info.name || path.basename(crxPath),
      sourcePath: path.resolve(crxPath),
      unpackedPath: dest,
      enabled: true,
      kind: 'crx',
    });
    sendState();
    return row;
  });

  ipcMain.handle('extensions:toggle', async (_e, id, enabled) => {
    const ext = store.getState().extensions.find((e) => e.id === id);
    if (!ext) throw new Error('扩展不存在');
    const ses = session.fromPartition(BROWSER_PARTITION);
    if (enabled) {
      const info = await loadUnpackedOnSession(ses, ext.unpackedPath || ext.sourcePath);
      ext.id = info.id;
      ext.name = info.name || ext.name;
      store.upsertExtension({ ...ext, enabled: true });
    } else {
      try {
        await removeFromSession(ses, ext.id);
      } catch {
        // already gone
      }
      store.setExtensionEnabled(id, false);
    }
    sendState();
    return store.getState().extensions.find((e) => e.id === ext.id || e.sourcePath === ext.sourcePath);
  });

  ipcMain.handle('extensions:uninstall', async (_e, id) => {
    const ext = store.getState().extensions.find((e) => e.id === id);
    if (!ext) throw new Error('扩展不存在');
    const ses = session.fromPartition(BROWSER_PARTITION);
    try {
      await removeFromSession(ses, ext.id);
    } catch {
      // ignore
    }
    if (ext.kind === 'crx' && ext.unpackedPath && ext.unpackedPath.startsWith(userDataPath('imported-crx'))) {
      fs.rmSync(ext.unpackedPath, { recursive: true, force: true });
    }
    store.removeExtension(id);
    sendState();
    return true;
  });

  ipcMain.handle('permissions:set', (_e, { origin, permission, allow }) => {
    store.setPermission(origin, permission, allow);
    sendState();
    return store.getState().permissions;
  });
}

async function restoreExtensions() {
  const ses = session.fromPartition(BROWSER_PARTITION);
  hardenSession(ses);
  for (const ext of store.getState().extensions) {
    if (!ext.enabled) continue;
    const dir = ext.unpackedPath || ext.sourcePath;
    if (!dir || !fs.existsSync(dir)) continue;
    try {
      const info = await loadUnpackedOnSession(ses, dir);
      store.upsertExtension({ ...ext, id: info.id, name: info.name || ext.name, enabled: true });
    } catch (err) {
      console.warn('restore extension failed', ext.name, err.message);
    }
  }
}

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: '文件',
      submenu: [
        {
          label: '添加文件…',
          click: () => mainWindow && mainWindow.webContents.send('ui:command', 'add-files'),
        },
        {
          label: '添加文件夹…',
          click: () => mainWindow && mainWindow.webContents.send('ui:command', 'add-folder'),
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit', label: '退出' },
      ],
    },
    {
      label: '查看',
      submenu: [
        { role: 'reload', label: '重新加载界面' },
        { role: 'togglefullscreen', label: '窗口全屏' },
        { type: 'separator' },
        { role: 'toggleDevTools', label: '开发者工具' },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(async () => {
  store = new LibraryStore(userDataPath('library.json'));
  store.load();

  app.on('session-created', (ses) => hardenSession(ses));
  hardenSession(session.defaultSession);
  session.fromPartition(BROWSER_PARTITION);
  session.fromPartition(persistPartitionKey('warmup'));

  bindIpc();
  await restoreExtensions();
  buildMenu();
  mainWindow = createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
