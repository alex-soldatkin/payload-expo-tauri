// Electron main entry point.
import { app, BrowserWindow } from 'electron'
import { registerSqliteHost } from './sqliteHost.mjs'
import { registerSettings } from './settings.mjs'
import { registerMenu, installDefaultMenu } from './menu.mjs'
import { createMainWindow } from './windows.mjs'

app.setName('Payload Universal Desktop')

app.whenReady().then(() => {
  registerSqliteHost()
  registerSettings()
  registerMenu()
  installDefaultMenu()
  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
