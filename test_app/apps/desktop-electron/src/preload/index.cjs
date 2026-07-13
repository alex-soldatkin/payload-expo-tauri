// Preload: expose a minimal, typed IPC surface to the renderer.
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('payloadSqlite', {
  open: (name) => ipcRenderer.invoke('sqlite:open', name),
  all: (dbId, sql, params) => ipcRenderer.invoke('sqlite:all', dbId, sql, params),
  run: (dbId, sql, params) => ipcRenderer.invoke('sqlite:run', dbId, sql, params),
  setPragma: (dbId, key, value) => ipcRenderer.invoke('sqlite:setPragma', dbId, key, value),
  close: (dbId) => ipcRenderer.invoke('sqlite:close', dbId),
})

contextBridge.exposeInMainWorld('payloadDesktop', {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (patch) => ipcRenderer.invoke('settings:set', patch),
  setMenu: (tree) => ipcRenderer.send('menu:set', tree),
  onMenuAction: (cb) => {
    const listener = (_event, action) => cb(action)
    ipcRenderer.on('menu:action', listener)
    return () => ipcRenderer.removeListener('menu:action', listener)
  },
  openWebAdmin: () => ipcRenderer.send('menu:open-web-admin'),
})
