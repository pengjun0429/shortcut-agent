const { app, BrowserWindow, globalShortcut } = require('electron');
const path = require('path');

let mainWindow;

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
}

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
