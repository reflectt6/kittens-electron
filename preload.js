// Preload script - bridges Electron and the game
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isElectron: true,

  // File save
  saveGameFile: (data) => ipcRenderer.invoke('save-game-file', data),
  loadLatestSave: () => ipcRenderer.invoke('load-latest-save'),
  listSaves: () => ipcRenderer.invoke('list-saves'),
  loadSaveFile: (filename) => ipcRenderer.invoke('load-save-file', filename),
});
