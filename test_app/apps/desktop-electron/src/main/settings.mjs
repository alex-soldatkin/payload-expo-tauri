// JSON-backed app settings at app.getPath('userData')/settings.json.
import { app, ipcMain } from 'electron'
import path from 'node:path'
import fs from 'node:fs'

function settingsPath() {
  return path.join(app.getPath('userData'), 'settings.json')
}

export function getSettings() {
  try {
    const raw = fs.readFileSync(settingsPath(), 'utf8')
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function setSettings(patch) {
  const current = getSettings()
  const next = { ...current, ...(patch && typeof patch === 'object' ? patch : {}) }
  const file = settingsPath()
  const tmp = `${file}.${process.pid}.tmp`
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(tmp, JSON.stringify(next, null, 2))
  fs.renameSync(tmp, file)
  return next
}

export function registerSettings() {
  ipcMain.handle('settings:get', () => getSettings())
  ipcMain.handle('settings:set', (_e, patch) => setSettings(patch))
}
