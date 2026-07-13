// Application menu built from a serializable tree sent by the renderer.
import { ipcMain, Menu } from 'electron'
import { getSettings } from './settings.mjs'
import { openWebAdminWindow } from './windows.mjs'

// The server address is user-configured (multitenancy) — there is no sane
// hardcoded fallback. Without it, web-admin actions are silently skipped.
function serverURL() {
  const url = getSettings().serverURL
  return typeof url === 'string' && url ? url : null
}

// Map one renderer menu item to an Electron template item. `sender` is the
// webContents that requested the menu (the main window renderer).
function mapItem(item, sender) {
  const mapped = {
    label: item.label,
    accelerator: item.accelerator,
    enabled: item.enabled,
  }
  if (Array.isArray(item.submenu)) {
    mapped.submenu = item.submenu.map((child) => mapItem(child, sender))
    return mapped
  }
  mapped.click = (_menuItem, _win, event) => handleAction(item.action, sender, event)
  return mapped
}

function handleAction(action, sender) {
  if (!action) return
  if (action === 'open-web-admin') {
    const url = serverURL()
    if (url) openWebAdminWindow(url)
    return
  }
  if (action === 'reload') {
    if (sender && !sender.isDestroyed()) sender.reload()
    return
  }
  if (sender && !sender.isDestroyed()) sender.send('menu:action', action)
}

function baseTemplate() {
  const template = []
  if (process.platform === 'darwin') template.push({ role: 'appMenu' })
  template.push({ role: 'editMenu' })
  return template
}

export function installDefaultMenu() {
  const template = baseTemplate()
  template.push({
    label: 'View',
    submenu: [{ role: 'reload' }],
  })
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

export function registerMenu() {
  ipcMain.on('menu:set', (event, tree) => {
    const sender = event.sender
    const template = baseTemplate()
    if (Array.isArray(tree)) {
      for (const item of tree) template.push(mapItem(item, sender))
    }
    Menu.setApplicationMenu(Menu.buildFromTemplate(template))
  })

  ipcMain.on('menu:open-web-admin', () => {
    const url = serverURL()
    if (url) openWebAdminWindow(url)
  })
}
