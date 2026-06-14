const { app, BrowserWindow, globalShortcut, dialog } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

let mainWindow;
let updateDownloaded = false;

// Disable auto-download, we'll handle it manually
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.allowDowngrade = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    title: '快捷鍵特工 — OS 密碼戰',
    backgroundColor: '#0a0c1c',
    autoHideMenuBar: true,
    frame: true,
    fullscreenable: true,
    icon: path.join(__dirname, 'build', 'icons', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.loadFile('game.html');

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Check for updates after window is ready
  checkForUpdates();
}

function checkForUpdates() {
  autoUpdater.checkForUpdates().catch((err) => {
    console.log('Update check failed:', err.message);
  });
}

// Update events
autoUpdater.on('checking-for-update', () => {
  console.log('Checking for updates...');
});

autoUpdater.on('update-available', (info) => {
  console.log('Update available:', info.version);
  if (mainWindow) {
    mainWindow.webContents.send('update-available', info.version);
  }
});

autoUpdater.on('update-not-available', () => {
  console.log('No updates available.');
});

autoUpdater.on('download-progress', (progress) => {
  console.log(`Download speed: ${progress.bytesPerSecond} - ${Math.round(progress.percent)}%`);
});

autoUpdater.on('update-downloaded', (info) => {
  console.log('Update downloaded:', info.version);
  updateDownloaded = true;

  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: '有新版本可用',
    message: `快捷鍵特工 ${info.version} 已下載完成`,
    detail: '應用程式將在重啟後自動更新。是否立即重啟？',
    buttons: ['立即重啟', '稍後'],
    defaultId: 0,
    cancelId: 1,
  }).then(({ response }) => {
    if (response === 0) {
      autoUpdater.quitAndInstall();
    }
  });
});

autoUpdater.on('error', (err) => {
  console.log('Auto-updater error:', err.message);
});

app.whenReady().then(() => {
  createWindow();

  const blockedKeys = [
    'CommandOrControl+R',
    'CommandOrControl+Shift+R',
    'F5',
    'F11',
    'CommandOrControl+W',
    'CommandOrControl+Q',
    'CommandOrControl+T',
    'CommandOrControl+N',
    'CommandOrControl+Shift+I',
    'F12',
  ];
  blockedKeys.forEach((key) => {
    try { globalShortcut.register(key, () => {}); } catch {}
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  globalShortcut.unregisterAll();
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
