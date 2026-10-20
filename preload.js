const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('chessHelper', {
  sendEngineCommand: (command) => ipcRenderer.send('engine:command', command),
  hideWindow: () => ipcRenderer.send('window:hide'),
  copyText: (text) => ipcRenderer.send('clipboard:write', text),
  onEngineLine: (callback) => {
    const listener = (_event, line) => callback(line);
    ipcRenderer.on('engine:line', listener);
    return () => ipcRenderer.removeListener('engine:line', listener);
  }
});
