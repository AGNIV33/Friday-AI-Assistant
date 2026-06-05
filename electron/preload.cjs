const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  openApp: (appName) => ipcRenderer.invoke('open-app', appName),
  closeApp: (appName) => ipcRenderer.invoke('close-app', appName),
  openFile: (filePath) => ipcRenderer.invoke('open-file', filePath),
  createFolder: (folderName, folderPath) => ipcRenderer.invoke('create-folder', { folderName, folderPath }),
  closeChromeTab: () => ipcRenderer.invoke('close-chrome-tab'),
  getSystemInfo: () => ipcRenderer.invoke('get-system-info'),
  getInstalledApps: () => ipcRenderer.invoke('get-installed-apps'),
  checkSocial: (platform) => ipcRenderer.invoke('check-social', platform),
  playMedia: (platform, query) => ipcRenderer.invoke('play-media', { platform, query }),
  searchGoogle: (query) => ipcRenderer.invoke('search-google', query),
  openInChrome: (url) => ipcRenderer.invoke('open-in-chrome', url),
  generateImage: (prompt) => ipcRenderer.invoke('generate-image', prompt),
  saveGeneratedImage: (fileName, savePath) => ipcRenderer.invoke('save-generated-image', { fileName, savePath }),
  // WhatsApp
  whatsappInit: () => ipcRenderer.invoke('whatsapp-init'),
  whatsappStatus: () => ipcRenderer.invoke('whatsapp-status'),
  whatsappSend: (contactNameOrNumber, message) => ipcRenderer.invoke('whatsapp-send', { contactNameOrNumber, message }),
  whatsappLogout: () => ipcRenderer.invoke('whatsapp-logout'),
  // System Controls
  systemVolume: (action, level) => ipcRenderer.invoke('system-volume', { action, level }),
  systemBrightness: (action, level) => ipcRenderer.invoke('system-brightness', { action, level }),
  openSettings: (page) => ipcRenderer.invoke('open-settings', page),
  bluetoothControl: (action, deviceName) => ipcRenderer.invoke('bluetooth-control', { action, deviceName }),
  wifiControl: (action, networkName, password) => ipcRenderer.invoke('wifi-control', { action, networkName, password }),
  // Window Management
  positionWindow: (appName, position) => ipcRenderer.invoke('position-window', { appName, position }),
  // Document Writing
  writeDocument: (target, content, title) => ipcRenderer.invoke('write-document', { target, content, title }),
  formatWord: (action, value) => ipcRenderer.invoke('format-word', { action, value }),
  // App Browser
  getAllApps: () => ipcRenderer.invoke('get-all-apps'),
  // File Search
  searchFiles: (query, searchIn, type) => ipcRenderer.invoke('search-files', { query, searchIn, type }),
  openSearchResult: (resultPath) => ipcRenderer.invoke('open-search-result', resultPath),
  // Image Search & Browse
  searchImages: (query, count) => ipcRenderer.invoke('search-images', { query, count }),
  browseImage: (direction) => ipcRenderer.invoke('browse-image', { direction }),
  saveBrowsedImage: (fileName, savePath) => ipcRenderer.invoke('save-browsed-image', { fileName, savePath }),
  // File Operations (open by name, delete, recycle bin, move, organize)
  openDocument: (name, searchIn) => ipcRenderer.invoke('open-document', { name, searchIn }),
  deleteFile: (filePath, permanently) => ipcRenderer.invoke('delete-file', { filePath, permanently }),
  emptyRecycleBin: () => ipcRenderer.invoke('empty-recycle-bin'),
  moveFile: (sourcePath, destPath) => ipcRenderer.invoke('move-file', { sourcePath, destPath }),
  organizeFolder: (folderPath, plan) => ipcRenderer.invoke('organize-folder', { folderPath, plan }),
  // Video / Episode Playback
  findAndPlayEpisode: (folderPath, season, episode, player) => ipcRenderer.invoke('find-play-episode', { folderPath, season, episode, player }),
  // Folder Contents
  listFolderContents: (folderPath, sortBy) => ipcRenderer.invoke('list-folder-contents', { folderPath, sortBy }),
  // Window Control (Sleep / Wake)
  fridayMinimize: () => ipcRenderer.invoke('friday-minimize'),
  fridayRestore: () => ipcRenderer.invoke('friday-restore'),
  // Conversation Cache (Persistent Local Memory)
  cacheStartSession: () => ipcRenderer.invoke('cache-start-session'),
  cacheSaveTurn: (role, text, toolName, toolArgs, toolResult) => ipcRenderer.invoke('cache-save-turn', { role, text, toolName, toolArgs, toolResult }),
  cacheEndSession: (summary, topics) => ipcRenderer.invoke('cache-end-session', { summary, topics }),
  cacheGetContext: () => ipcRenderer.invoke('cache-get-context'),
  cacheGetFrequent: () => ipcRenderer.invoke('cache-get-frequent'),
  // Widgets
  fetchNews: () => ipcRenderer.invoke('fetch-news'),
  searchYoutubeEmbed: (query) => ipcRenderer.invoke('search-youtube-embed', { query }),
  searchYoutubeNews: (query) => ipcRenderer.invoke('search-youtube-news', { query }),
});

// ─── Vision Module (isolated from electronAPI) ────────────────────────────────
contextBridge.exposeInMainWorld('fridayVision', {
  captureScreen: () => ipcRenderer.invoke('capture-screen'),
  getCursorPosition: () => ipcRenderer.invoke('get-cursor-position'),
  analyzeVision: (args) => ipcRenderer.invoke('analyze-vision', args),
});
