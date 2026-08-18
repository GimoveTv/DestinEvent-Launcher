/**
 * @author Luuxis
 * Luuxis License v1.0 (voir fichier LICENSE pour les détails en FR/EN)
 */

const { app, ipcMain, nativeTheme, session } = require('electron');
const { Microsoft } = require('minecraft-java-core');
const { autoUpdater } = require('electron-updater')

const path = require('path');
const fs = require('fs');
const Store = require('electron-store');

const UpdateWindow = require("./assets/js/windows/updateWindow.js");
const MainWindow = require("./assets/js/windows/mainWindow.js");

let dev = process.env.NODE_ENV === 'dev';

if (dev) {
    let appPath = path.resolve('./data/Launcher').replace(/\\/g, '/');
    let appdata = path.resolve('./data').replace(/\\/g, '/');
    if (!fs.existsSync(appPath)) fs.mkdirSync(appPath, { recursive: true });
    if (!fs.existsSync(appdata)) fs.mkdirSync(appdata, { recursive: true });
    app.setPath('userData', appPath);
    app.setPath('appData', appdata)
}

Store.initRenderer();

if (!app.requestSingleInstanceLock()) app.quit();
else app.whenReady().then(() => {
    UpdateWindow.createWindow();
});

ipcMain.on('main-window-open', () => {
    let win = MainWindow.getWindow();
    if (win && !win.isDestroyed()) {
        win.show();
        win.focus();
    } else {
        MainWindow.createWindow();
    }
});
ipcMain.on('main-window-dev-tools', () => {
    let win = MainWindow.getWindow();
    if (win) win.webContents.openDevTools({ mode: 'detach' });
});
ipcMain.on('main-window-dev-tools-close', () => {
    let win = MainWindow.getWindow();
    if (win) win.webContents.closeDevTools();
});
ipcMain.on('main-window-close', () => MainWindow.destroyWindow());
ipcMain.on('main-window-reload', () => {
    let win = MainWindow.getWindow();
    if (win) win.reload();
});
ipcMain.on('main-window-progress', (event, options) => {
    let win = MainWindow.getWindow();
    if (win && options && options.size) win.setProgressBar(options.progress / options.size);
});
ipcMain.on('main-window-progress-reset', () => {
    let win = MainWindow.getWindow();
    if (win) win.setProgressBar(-1);
});
ipcMain.on('main-window-progress-load', () => {
    let win = MainWindow.getWindow();
    if (win) win.setProgressBar(2);
});
ipcMain.on('main-window-minimize', () => {
    let win = MainWindow.getWindow();
    if (win) win.minimize();
});

ipcMain.on('update-window-close', () => UpdateWindow.destroyWindow());
ipcMain.on('update-window-dev-tools', () => {
    let win = UpdateWindow.getWindow();
    if (win) win.webContents.openDevTools({ mode: 'detach' });
});
ipcMain.on('update-window-progress', (event, options) => {
    let win = UpdateWindow.getWindow();
    if (win && options && options.size) win.setProgressBar(options.progress / options.size);
});
ipcMain.on('update-window-progress-reset', () => {
    let win = UpdateWindow.getWindow();
    if (win) win.setProgressBar(-1);
});
ipcMain.on('update-window-progress-load', () => {
    let win = UpdateWindow.getWindow();
    if (win) win.setProgressBar(2);
});

ipcMain.handle('path-user-data', () => app.getPath('userData'));
ipcMain.handle('appData', e => app.getPath('appData'));

ipcMain.on('main-window-maximize', () => {
    let win = MainWindow.getWindow();
    if (win) {
        if (win.isMaximized()) {
            win.unmaximize();
        } else {
            win.maximize();
        }
    }
});

ipcMain.on('main-window-hide', () => {
    let win = MainWindow.getWindow();
    if (win) win.hide();
});
ipcMain.on('main-window-show', () => {
    let win = MainWindow.getWindow();
    if (win) win.show();
});

ipcMain.handle('Microsoft-window', async (_, client_id) => {
    try {
        if (session.defaultSession) {
            await session.defaultSession.clearStorageData({
                storages: ['appcache', 'cookies', 'filesystem', 'indexdb', 'localstorage', 'shadercache', 'websql', 'serviceworkers', 'cachestorage']
            });
            await session.defaultSession.clearCache();
            await session.defaultSession.clearAuthCache();
        }
    } catch (e) {
        console.error('Error clearing session storage:', e);
    }
    const ms = new Microsoft(client_id);
    const loginUrl = `https://login.live.com/oauth20_authorize.srf?client_id=${client_id || '00000000402b5328'}&response_type=code&redirect_uri=https://login.live.com/oauth20_desktop.srf&scope=XboxLive.signin%20offline_access&prompt=login`;
    return await ms.getAuth('electron', loginUrl);
})

ipcMain.handle('is-dark-theme', (_, theme) => {
    if (theme === 'dark') return true
    if (theme === 'light') return false
    return nativeTheme.shouldUseDarkColors;
})

app.on('window-all-closed', () => app.quit());

autoUpdater.autoDownload = false;

ipcMain.handle('update-app', async () => {
    if (dev) {
        setTimeout(() => {
            const updateWindow = UpdateWindow.getWindow();
            if (updateWindow) updateWindow.webContents.send('update-not-available');
        }, 800);
        return { dev: true };
    }
    return await new Promise(async (resolve, reject) => {
        autoUpdater.checkForUpdates().then(res => {
            resolve(res);
        }).catch(error => {
            reject({
                error: true,
                message: error
            })
        })
    })
})

autoUpdater.on('update-available', () => {
    const updateWindow = UpdateWindow.getWindow();
    if (updateWindow) updateWindow.webContents.send('updateAvailable');
});

ipcMain.on('start-update', () => {
    autoUpdater.downloadUpdate();
})

autoUpdater.on('update-not-available', () => {
    const updateWindow = UpdateWindow.getWindow();
    if (updateWindow) updateWindow.webContents.send('update-not-available');
});

autoUpdater.on('update-downloaded', () => {
    autoUpdater.quitAndInstall();
});

autoUpdater.on('download-progress', (progress) => {
    const updateWindow = UpdateWindow.getWindow();
    if (updateWindow) updateWindow.webContents.send('download-progress', progress);
})

autoUpdater.on('error', (err) => {
    const updateWindow = UpdateWindow.getWindow();
    if (updateWindow) updateWindow.webContents.send('error', err);
});