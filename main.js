// Electron-Hauptprozess: prüft beim Start auf Updates (GitHub Releases),
// installiert sie automatisch und öffnet danach das Spiel.
const { app, BrowserWindow, shell } = require('electron');
const path = require('node:path');
const { autoUpdater } = require('electron-updater');

const ICON = path.join(__dirname, 'build', 'icon.png');
let splash = null;
let win = null;

function webPrefs() {
  return {
    preload: path.join(__dirname, 'preload.js'),
    contextIsolation: true,
    nodeIntegration: false,
    additionalArguments: [`--app-version=${app.getVersion()}`],
  };
}

function createMain() {
  if (win) return;
  win = new BrowserWindow({
    width: 1600, height: 950, minWidth: 1100, minHeight: 700,
    backgroundColor: '#E4D8BC', show: false, autoHideMenuBar: true,
    title: 'Grand Tour 1900', icon: ICON, webPreferences: webPrefs(),
  });
  win.setMenuBarVisibility(false);
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.loadFile(path.join(__dirname, 'src', 'index.html'));
  win.once('ready-to-show', () => {
    win.maximize();
    win.show();
    if (splash && !splash.isDestroyed()) splash.close();
  });
}

function createSplash() {
  splash = new BrowserWindow({
    width: 460, height: 300, frame: false, resizable: false, center: true,
    backgroundColor: '#FBF8F0', icon: ICON, webPreferences: webPrefs(),
  });
  splash.loadFile(path.join(__dirname, 'src', 'update.html'));
}

function checkForUpdates() {
  createSplash();
  const status = s => { if (splash && !splash.isDestroyed()) splash.webContents.send('update-status', s); };
  let decided = false;
  const proceed = () => { if (decided) return; decided = true; createMain(); };

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('checking-for-update', () => status({ text: 'Suche nach Updates …' }));
  autoUpdater.on('update-available', info => { decided = true; status({ text: `Neue Version ${info.version} wird geladen …`, progress: 0 }); });
  autoUpdater.on('download-progress', p => status({ text: 'Update wird geladen …', progress: p.percent }));
  autoUpdater.on('update-not-available', () => { status({ text: 'Das Spiel ist aktuell.' }); setTimeout(proceed, 400); });
  autoUpdater.on('update-downloaded', () => {
    status({ text: 'Update wird installiert – das Spiel startet gleich neu …', progress: 100 });
    setTimeout(() => autoUpdater.quitAndInstall(true, true), 1200);
  });
  autoUpdater.on('error', err => {
    console.error('Update-Fehler:', err?.message);
    // Ohne Internet oder bei Fehlern einfach mit der installierten Version starten
    if (!decided) { status({ text: 'Keine Update-Prüfung möglich – starte Spiel …' }); setTimeout(proceed, 800); }
    else { decided = false; proceed(); }
  });
  // Falls die Prüfung hängt: nach 10 s ohne Update-Fund trotzdem starten
  setTimeout(() => { if (!decided) proceed(); }, 10000);
  autoUpdater.checkForUpdates().catch(() => proceed());
}

app.whenReady().then(() => {
  if (app.isPackaged) checkForUpdates();
  else createMain(); // Entwicklungsmodus (npm start): keine Update-Prüfung
});

app.on('window-all-closed', () => app.quit());
