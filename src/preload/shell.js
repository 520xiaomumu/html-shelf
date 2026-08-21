'use strict';

const { contextBridge, ipcRenderer, webUtils } = require('electron');

function subscribe(channel, cb) {
  const listener = (_event, payload) => cb(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('shelf', {
  getState: () => ipcRenderer.invoke('library:get'),
  addFiles: (paths) => ipcRenderer.invoke('library:addFiles', paths),
  addFolder: (dir) => ipcRenderer.invoke('library:addFolder', dir),
  addDropped: (paths) => ipcRenderer.invoke('library:addDropped', paths),
  addUrl: (url) => ipcRenderer.invoke('library:addUrl', url),
  updateItem: (id, patch) => ipcRenderer.invoke('library:updateItem', id, patch),
  removeItem: (id) => ipcRenderer.invoke('library:removeItem', id),
  addCategory: (name, parentId) => ipcRenderer.invoke('library:addCategory', { name, parentId }),
  updateCategory: (id, patch) => ipcRenderer.invoke('library:updateCategory', id, patch),
  removeCategory: (id) => ipcRenderer.invoke('library:removeCategory', id),
  setSort: (sort) => ipcRenderer.invoke('library:setSort', sort),
  openItem: (id) => ipcRenderer.invoke('library:openItem', id),
  pickFiles: () => ipcRenderer.invoke('dialog:pickFiles'),
  pickFolder: () => ipcRenderer.invoke('dialog:pickFolder'),
  pickCover: () => ipcRenderer.invoke('dialog:pickCover'),
  pickUnpacked: () => ipcRenderer.invoke('dialog:pickUnpacked'),
  pickCrx: () => ipcRenderer.invoke('dialog:pickCrx'),
  openUrl: (url) => ipcRenderer.invoke('browser:openUrl', url),
  home: () => ipcRenderer.invoke('browser:home'),
  toggleFullscreen: () => ipcRenderer.invoke('window:toggleFullscreen'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  openLibraryDir: () => ipcRenderer.invoke('settings:openLibraryDir'),
  listExtensions: () => ipcRenderer.invoke('extensions:list'),
  loadUnpacked: (dir) => ipcRenderer.invoke('extensions:loadUnpacked', dir),
  importCrx: (file) => ipcRenderer.invoke('extensions:importCrx', file),
  toggleExtension: (id, enabled) => ipcRenderer.invoke('extensions:toggle', id, enabled),
  uninstallExtension: (id) => ipcRenderer.invoke('extensions:uninstall', id),
  setPermission: (origin, permission, allow) =>
    ipcRenderer.invoke('permissions:set', { origin, permission, allow }),
  pathForFile: (file) => {
    if (webUtils && typeof webUtils.getPathForFile === 'function') {
      return webUtils.getPathForFile(file);
    }
    return file.path;
  },
  onState: (cb) => subscribe('library:changed', cb),
  onOpenTab: (cb) => subscribe('ui:open-tab', cb),
  onView: (cb) => subscribe('ui:view', cb),
  onCommand: (cb) => subscribe('ui:command', cb),
});
