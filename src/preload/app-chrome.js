'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('appChrome', {
  home: () => ipcRenderer.invoke('browser:home'),
  toggleFullscreen: () => ipcRenderer.invoke('window:toggleFullscreen'),
  getState: () => ipcRenderer.invoke('library:get'),
});
