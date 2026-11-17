const { contextBridge, ipcRenderer } = require('electron');

const arg = process.argv.find(a => a.startsWith('--app-version='));
contextBridge.exposeInMainWorld('app', {
  version: arg ? arg.split('=')[1] : 'dev',
  onUpdateStatus: cb => ipcRenderer.on('update-status', (_e, s) => cb(s)),
});
