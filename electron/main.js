// WJSIM — Electron main process
'use strict';
const { app, BrowserWindow, Menu, ipcMain, dialog, shell, session } = require('electron');
const path = require('path');
const fs = require('fs');

const isMac = process.platform === 'darwin';
const windows = new Set();
let pendingFile = null;

const MAX_FILE = 20 * 1024 * 1024;
// files the person picked in a dialog or opened with the app: the page may save back to these, nowhere else
const grantedPaths = new Set();
function readProjectFile(p) {
  const st = fs.statSync(p);
  if (!st.isFile() || st.size > MAX_FILE) throw new Error('ไฟล์ใหญ่เกินไปหรือไม่ใช่ไฟล์โปรเจกต์');
  grantedPaths.add(path.resolve(p));
  return { text: fs.readFileSync(p, 'utf8'), path: p, name: path.basename(p) };
}
// IPC only from our own page (a file inside this app), never from an embedded frame or another site
const APP_DIR = path.resolve(__dirname, '..', 'src');
function fromApp(e) {
  const f = e.senderFrame;
  if (!f || f.parent) return false;
  try {
    const u = new URL(f.url);
    if (u.protocol !== 'file:') return false;
    const p = path.resolve(decodeURIComponent(u.pathname).replace(/^\/([A-Za-z]:)/, '$1'));
    return p.startsWith(APP_DIR);
  } catch (err) { return false; }
}

function createWindow(fileToOpen) {
  const win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 1000, minHeight: 640,
    backgroundColor: '#1d1d1d', title: 'WJSIM', show: false,
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false
    }
  });
  windows.add(win);
  win.loadFile(path.join(__dirname, '..', 'src', 'index.html'));
  win.once('ready-to-show', () => win.show());
  win.webContents.setWindowOpenHandler(({ url }) => {
    // Google sign-in opens its own popup; other links go to the person's browser
    if (/^https:\/\/([a-z0-9-]+\.)*(firebaseapp\.com|accounts\.google\.com|google\.com)\//.test(url)) return { action: 'allow', overrideBrowserWindowOptions: { webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } } };
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.webContents.on('will-attach-webview', (e) => e.preventDefault());
  win.webContents.once('did-finish-load', () => {
    if (fileToOpen) { try { win.webContents.send('open-file', readProjectFile(fileToOpen)); } catch (err) { dialog.showErrorBox('เปิดไฟล์ไม่ได้', String(err)); } }
  });
  let closing = false;
  win.on('close', async (e) => {
    if (closing) return;
    e.preventDefault();
    let dirty = false;
    try { dirty = await win.webContents.executeJavaScript('window.__iotfIsDirty ? window.__iotfIsDirty() : false'); } catch (err) { dirty = false; }
    if (dirty) {
      const r = dialog.showMessageBoxSync(win, { type: 'question', buttons: ['ปิดโดยไม่บันทึก', 'ยกเลิก'], defaultId: 1, cancelId: 1, message: 'โปรเจกต์ยังไม่ได้บันทึก', detail: 'ต้องการปิดหน้าต่างนี้โดยไม่บันทึกไหม?' });
      if (r !== 0) return;
    }
    closing = true; win.close();
  });
  win.on('closed', () => windows.delete(win));
  return win;
}

const send = (cmd) => { const w = BrowserWindow.getFocusedWindow(); if (w) w.webContents.send('menu', cmd); };

function buildMenu() {
  const template = [
    ...(isMac ? [{ label: 'WJSIM', submenu: [{ label: 'เกี่ยวกับ WJSIM', click: () => send('about') }, { type: 'separator' }, { role: 'services' }, { type: 'separator' }, { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' }, { type: 'separator' }, { role: 'quit', label: 'ออกจาก WJSIM' }] }] : []),
    {
      label: 'ไฟล์',
      submenu: [
        { label: 'โปรเจกต์ใหม่', accelerator: 'CmdOrCtrl+N', click: () => send('new') },
        { label: 'หน้าต่างใหม่', accelerator: 'CmdOrCtrl+Shift+N', click: () => createWindow() },
        { label: 'เปิดไฟล์…', accelerator: 'CmdOrCtrl+O', click: () => send('open') },
        { type: 'separator' },
        { label: 'โปรเจกต์ของฉัน', accelerator: 'CmdOrCtrl+Shift+P', click: () => send('projects') },
        { label: 'บันทึก', accelerator: 'CmdOrCtrl+S', click: () => send('save') },
        { label: 'บันทึกเป็นไฟล์ .iotf…', accelerator: 'CmdOrCtrl+Shift+S', click: () => send('saveAs') },
        { label: 'ส่งออกโค้ด .ino…', accelerator: 'CmdOrCtrl+E', click: () => send('export') },
        { type: 'separator' },
        { label: 'ตัวอย่างโปรเจกต์…', click: () => send('examples') },
        { type: 'separator' },
        isMac ? { role: 'close', label: 'ปิดหน้าต่าง' } : { role: 'quit', label: 'ออก' }
      ]
    },
    {
      label: 'แก้ไข',
      submenu: [
        { label: 'ย้อนกลับ', accelerator: 'CmdOrCtrl+Z', click: () => send('undo') },
        { label: 'ทำซ้ำ', accelerator: isMac ? 'Cmd+Shift+Z' : 'Ctrl+Y', click: () => send('redo') },
        { type: 'separator' },
        { role: 'cut', label: 'ตัด' }, { role: 'copy', label: 'คัดลอก' }, { role: 'paste', label: 'วาง' }, { role: 'selectAll', label: 'เลือกทั้งหมด' }
      ]
    },
    {
      label: 'จำลอง',
      submenu: [{ label: 'เริ่ม / หยุดจำลอง', accelerator: 'CmdOrCtrl+Return', click: () => send('run') }]
    },
    {
      label: 'มุมมอง',
      submenu: [{ role: 'resetZoom', label: 'ขนาดปกติ' }, { role: 'zoomIn', label: 'ขยายตัวอักษร' }, { role: 'zoomOut', label: 'ย่อตัวอักษร' }, { type: 'separator' }, { role: 'togglefullscreen', label: 'เต็มจอ' }]
    },
    {
      label: 'ช่วยเหลือ',
      submenu: [{ label: 'เกี่ยวกับและเครดิต', click: () => send('about') }, { type: 'separator' }, { role: 'toggleDevTools', label: 'เครื่องมือนักพัฒนา' }]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/* ---------- IPC ---------- */
const PROJECT_FILTER = [{ name: 'WJSIM Project', extensions: ['iotf'] }, { name: 'JSON', extensions: ['json'] }];
ipcMain.handle('save-project', async (e, data, filePath, defaultName) => {
  if (!fromApp(e) || typeof data !== 'string' || data.length > MAX_FILE) return null;
  const win = BrowserWindow.fromWebContents(e.sender);
  // save in place only to a file the person chose or opened; any other path asks first
  let p = typeof filePath === 'string' && grantedPaths.has(path.resolve(filePath)) ? filePath : null;
  if (!p) {
    const r = await dialog.showSaveDialog(win, { title: 'บันทึกโปรเจกต์', defaultPath: defaultName || 'project.iotf', filters: PROJECT_FILTER });
    if (r.canceled || !r.filePath) return null;
    p = r.filePath;
    grantedPaths.add(path.resolve(p));
  }
  fs.writeFileSync(p, data, 'utf8');
  return { path: p, name: path.basename(p) };
});
ipcMain.handle('open-project', async (e) => {
  if (!fromApp(e)) return null;
  const win = BrowserWindow.fromWebContents(e.sender);
  const r = await dialog.showOpenDialog(win, { title: 'เปิดโปรเจกต์', filters: PROJECT_FILTER, properties: ['openFile'] });
  if (r.canceled || !r.filePaths.length) return null;
  return readProjectFile(r.filePaths[0]);
});
ipcMain.handle('export-ino', async (e, text, defaultName) => {
  if (!fromApp(e) || typeof text !== 'string' || text.length > MAX_FILE) return null;
  const win = BrowserWindow.fromWebContents(e.sender);
  const r = await dialog.showSaveDialog(win, { title: 'ส่งออกโค้ดสำหรับ Arduino IDE', defaultPath: defaultName || 'sketch.ino', filters: [{ name: 'Arduino Sketch', extensions: ['ino'] }] });
  if (r.canceled || !r.filePath) return null;
  fs.writeFileSync(r.filePath, text, 'utf8');
  return { path: r.filePath };
});
ipcMain.on('set-title', (e, title) => { if (!fromApp(e)) return; const w = BrowserWindow.fromWebContents(e.sender); if (w) w.setTitle(String(title).slice(0, 200)); });
// the in-app MQTT/LoRa bus: forward messages to every other window so several boards can talk
ipcMain.on('bus-send', (e, msg) => { if (!fromApp(e)) return; try { if (JSON.stringify(msg).length > 1e6) return; } catch (err) { return; } windows.forEach((w) => { if (w.webContents !== e.sender && !w.isDestroyed()) w.webContents.send('bus', msg); }); });

/* ---------- app lifecycle ---------- */
const fileArg = (argv) => argv.slice(1).find((a) => /\.(iotf)$/i.test(a) && fs.existsSync(a));
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', (e, argv) => {
    const f = fileArg(argv);
    if (f) createWindow(f);
    else { const w = [...windows][0]; if (w) { if (w.isMinimized()) w.restore(); w.focus(); } }
  });
  app.on('open-file', (e, p) => { e.preventDefault(); if (app.isReady()) createWindow(p); else pendingFile = p; });
  app.whenReady().then(() => {
    // no camera, microphone, location, notifications or other device access for pages
    session.defaultSession.setPermissionRequestHandler((wc, perm, cb) => cb(false));
    session.defaultSession.setPermissionCheckHandler(() => false);
    buildMenu();
    createWindow(pendingFile || fileArg(process.argv));
    app.on('activate', () => { if (!windows.size) createWindow(); });
  });
  app.on('window-all-closed', () => { if (!isMac) app.quit(); });
}
