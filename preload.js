// Preload script - bridges Electron and the game
// Exposes minimal safe APIs to the renderer process

const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isElectron: true
});
