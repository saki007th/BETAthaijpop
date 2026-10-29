// ==========================================
// electron/preload.js - IPC bridge: renderer <-> main process
// ==========================================
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    isElectron: true,
    updatePresence: (activity) => ipcRenderer.invoke('discord:update-presence', activity),
    clearPresence: () => ipcRenderer.invoke('discord:clear-presence'),
    getStatus: () => ipcRenderer.invoke('discord:get-status'),
    openYouTubeLogin: () => ipcRenderer.invoke('discord:open-yt-login'),
});
