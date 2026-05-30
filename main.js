const { app, BrowserWindow, Menu, dialog, Tray, nativeImage } = require('electron');
const path = require('path');

let mainWindow = null;
let tray = null;
let isQuitting = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    title: '猫国建设者 - Kittens Game',
    icon: path.join(__dirname, 'app', 'res', 'favicon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false  // Allow file:// XHR for SystemJS module loading
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'app', 'index.html'));

  // Auto-open DevTools for debugging
  mainWindow.webContents.openDevTools();

  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      dialog.showMessageBox(mainWindow, {
        type: 'question',
        buttons: ['取消', '直接退出', '保存并退出'],
        defaultId: 2,
        title: '猫国建设者',
        message: '确定要退出吗？',
        detail: '建议先导出存档再退出。选择"保存并退出"将触发自动保存。'
      }).then(({ response }) => {
        if (response === 2) {
          // Save and quit
          mainWindow.webContents.executeJavaScript('if(typeof gamePage !== "undefined") { gamePage.saveUI(); }');
          setTimeout(() => {
            isQuitting = true;
            mainWindow.close();
          }, 500);
        } else if (response === 1) {
          isQuitting = true;
          mainWindow.close();
        }
      });
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  buildMenu();
}

function buildMenu() {
  const template = [
    {
      label: '游戏',
      submenu: [
        {
          label: '保存',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            mainWindow.webContents.executeJavaScript('if(typeof gamePage !== "undefined") { gamePage.saveUI(); }');
          }
        },
        {
          label: '导出存档',
          accelerator: 'CmdOrCtrl+E',
          click: () => {
            mainWindow.webContents.executeJavaScript('if(typeof gamePage !== "undefined") { gamePage.saveExport(); }');
          }
        },
        {
          label: '导入存档',
          accelerator: 'CmdOrCtrl+I',
          click: () => {
            mainWindow.webContents.executeJavaScript('if(typeof gamePage !== "undefined") { $("#importData").val(""); $("#importDiv").show(); }');
          }
        },
        { type: 'separator' },
        {
          label: '重置游戏',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'warning',
              buttons: ['取消', '确认重置'],
              defaultId: 0,
              title: '重置确认',
              message: '确定要重置游戏吗？所有进度将丢失！'
            }).then(({ response }) => {
              if (response === 1) {
                mainWindow.webContents.executeJavaScript('if(typeof gamePage !== "undefined") { gamePage.reset(); }');
              }
            });
          }
        },
        { type: 'separator' },
        { role: 'quit', label: '退出' }
      ]
    },
    {
      label: '查看',
      submenu: [
        { role: 'reload', label: '刷新' },
        { role: 'toggleDevTools', label: '开发者工具' },
        { type: 'separator' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { role: 'resetZoom', label: '重置缩放' }
      ]
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '猫国百科',
          click: () => {
            require('electron').shell.openExternal('https://petercheney.gitee.io/baike/');
          }
        },
        {
          label: '关于',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: '关于猫国建设者',
              message: '猫国建设者 - Kittens Game 桌面版',
              detail: '原作者: bloodrizer (nuclearunicorn)\n汉化: 锅巴汉化 (g8hh.com)\n桌面版移植基于 Electron\n\n版本: 1.4.9.0'
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
});
