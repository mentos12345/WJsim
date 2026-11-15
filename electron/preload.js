// Wongjorn — preload: the only bridge between the page and the operating system
'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('iotfHost', {
  platform: process.platform,
  saveProject: (data, filePath, defaultName) => ipcRenderer.invoke('save-project', data, filePath, defaultName),
  openProject: () => ipcRenderer.invoke('open-project'),
  exportIno: (text, defaultName) => ipcRenderer.invoke('export-ino', text, defaultName),
  setTitle: (t) => ipcRenderer.send('set-title', t),
  busSend: (msg) => ipcRenderer.send('bus-send', msg),
  onBus: (fn) => ipcRenderer.on('bus', (e, msg) => fn(msg)),
  onMenu: (fn) => ipcRenderer.on('menu', (e, cmd) => fn(cmd)),
  onOpenFile: (fn) => ipcRenderer.on('open-file', (e, file) => fn(file))
});
