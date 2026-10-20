const { app, BrowserWindow, globalShortcut, ipcMain, clipboard } = require('electron');
const path = require('node:path');

let win;
let engine;
let ready = false;
let queued = [];

function sendLine(line) {
  if (win && !win.isDestroyed()) win.webContents.send('engine:line', String(line));
}

function startEngine() {
  // Stockfish package provides a Node API that resolves its own WASM files.
  // This avoids browser Worker paths and file:// WASM-loading issues.
  const stockfish = require('stockfish');
  engine = stockfish('lite-single', (line) => {
    line = String(line);
    sendLine(line);
    if (line.trim() === 'uciok') {
      engine.processCommand('setoption name MultiPV value 3');
      engine.processCommand('isready');
    } else if (line.trim() === 'readyok') {
      ready = true;
      for (const command of queued) engine.processCommand(command);
      queued = [];
    }
  });
  engine.processCommand('uci');
}

function engineCommand(command) {
  if (!engine || typeof command !== 'string' || command.length > 5000) return;
  if (!ready && !['uci', 'isready'].includes(command)) queued.push(command);
  else engine.processCommand(command);
}

function createWindow() {
  win = new BrowserWindow({
    width: 460, height: 790, minWidth: 400, minHeight: 650,
    alwaysOnTop: true, frame: false, backgroundColor: '#171923', show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: true
    }
  });
  win.loadFile('index.html');
  win.once('ready-to-show', () => win.show());
  win.on('closed', () => { win = null; });
}

app.whenReady().then(() => {
  createWindow();
  startEngine();
  globalShortcut.register('Control+Shift+H', () => {
    if (!win) return;
    if (win.isVisible()) win.hide();
    else { win.show(); win.focus(); }
  });
  ipcMain.on('engine:command', (_e, command) => engineCommand(command));
  ipcMain.on('window:hide', () => win?.hide());
  ipcMain.on('clipboard:write', (_e, value) => {
    if (typeof value === 'string' && value.length < 100000) clipboard.writeText(value);
  });
});
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  try { engine?.processCommand('quit'); } catch {}
  try { engine?.terminate?.(); } catch {}
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
