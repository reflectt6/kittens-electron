process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';

const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// Save data path: %APPDATA%/kittens-game/saves/
const USER_DATA = path.join(app.getPath('appData'), 'kittens-game');
const SAVES_DIR = path.join(USER_DATA, 'saves');
app.setPath('userData', USER_DATA);
ensureDir(SAVES_DIR);

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

let mainWindow = null;
let isQuitting = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 650,
    minHeight: 500,
    title: 'Kittens Game',
    icon: path.join(__dirname, 'app', 'res', 'favicon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'app', 'index.html'));
  // mainWindow.webContents.openDevTools();  // uncomment for debugging

  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      dialog.showMessageBox(mainWindow, {
        type: 'question',
        buttons: ['Cancel', 'Quit', 'Save & Quit'],
        defaultId: 2,
        title: 'Kittens Game',
        message: 'Are you sure you want to quit?',
        detail: 'Saves are stored in: ' + SAVES_DIR
      }).then(({ response }) => {
        if (response === 2) {
          mainWindow.webContents.executeJavaScript('if(typeof gamePage !== "undefined") { gamePage.saveUI(); if(typeof saveToFile === "function") saveToFile(); }');
          setTimeout(() => { isQuitting = true; mainWindow.close(); }, 500);
        } else if (response === 1) {
          isQuitting = true;
          mainWindow.close();
        }
      });
    }
  });

  mainWindow.on('closed', () => { mainWindow = null; });
  buildMenu();
}

function buildMenu() {
  const template = [
    {
      label: 'Game',
      submenu: [
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            mainWindow.webContents.executeJavaScript('if(typeof gamePage !== "undefined") { gamePage.saveUI(); if(typeof saveToFile === "function") saveToFile(); }');
          }
        },
        {
          label: 'Export',
          accelerator: 'CmdOrCtrl+E',
          click: () => {
            mainWindow.webContents.executeJavaScript('if(typeof gamePage !== "undefined") { gamePage.saveExport(); }');
          }
        },
        {
          label: 'Import',
          accelerator: 'CmdOrCtrl+I',
          click: () => {
            mainWindow.webContents.executeJavaScript('if(typeof gamePage !== "undefined") { $("#importData").val(""); $("#importDiv").show(); }');
          }
        },
        { type: 'separator' },
        {
          label: 'Reset',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'warning',
              buttons: ['Cancel', 'Confirm Reset'],
              defaultId: 0,
              title: 'Reset Confirmation',
              message: 'Are you sure you want to reset? All progress will be lost!'
            }).then(({ response }) => {
              if (response === 1) {
                mainWindow.webContents.executeJavaScript('if(typeof gamePage !== "undefined") { gamePage.reset(); }');
              }
            });
          }
        },
        { type: 'separator' },
        { role: 'quit', label: 'Quit' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload', label: 'Reload' },
        { role: 'toggleDevTools', label: 'Developer Tools' },
        { type: 'separator' },
        { role: 'zoomIn', label: 'Zoom In' },
        { role: 'zoomOut', label: 'Zoom Out' },
        { role: 'resetZoom', label: 'Reset Zoom' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Open Saves Folder',
          click: () => { require('electron').shell.openPath(SAVES_DIR); }
        },
        {
          label: 'Kittens Game Wiki',
          click: () => { require('electron').shell.openExternal('https://kittensgame.fandom.com/wiki/Kittens_Game_Wiki'); }
        },
        {
          label: 'About',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About Kittens Game',
              message: 'Kittens Game - Desktop Edition',
              detail: 'Original: bloodrizer (nuclearunicorn)\nBuilt with Electron\nSaves: ' + SAVES_DIR + '\n\nGame version: 1.5.0.2'
            });
          }
        }
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ============== IPC: File save system ==============

ipcMain.handle('save-game-file', (event, data) => {
  try {
    const now = new Date();
    const ts = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'), '_',
      String(now.getHours()).padStart(2, '0'),
      String(now.getMinutes()).padStart(2, '0'),
      String(now.getSeconds()).padStart(2, '0'),
    ].join('');
    const filename = `save_${ts}.txt`;
    const filepath = path.join(SAVES_DIR, filename);
    fs.writeFileSync(filepath, data, 'utf-8');
    fs.writeFileSync(path.join(SAVES_DIR, 'latest.txt'), data, 'utf-8');
    return { success: true, path: filepath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('load-latest-save', () => {
  const latestPath = path.join(SAVES_DIR, 'latest.txt');
  if (fs.existsSync(latestPath)) {
    return { success: true, data: fs.readFileSync(latestPath, 'utf-8') };
  }
  return { success: false, error: 'No save file found' };
});

ipcMain.handle('list-saves', () => {
  try {
    const files = fs.readdirSync(SAVES_DIR)
      .filter(f => f.startsWith('save_') && f.endsWith('.txt'))
      .sort().reverse()
      .map(f => ({
        name: f,
        path: path.join(SAVES_DIR, f),
        mtime: fs.statSync(path.join(SAVES_DIR, f)).mtime.toISOString()
      }));
    return { success: true, files };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('load-save-file', (event, filename) => {
  const filepath = path.join(SAVES_DIR, filename);
  if (fs.existsSync(filepath)) {
    return { success: true, data: fs.readFileSync(filepath, 'utf-8') };
  }
  return { success: false, error: 'File not found' };
});

// ============== App lifecycle ==============

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => { isQuitting = true; });
