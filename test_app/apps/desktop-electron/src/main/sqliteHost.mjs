// Main-process SQLite host. The renderer never touches SQLite directly; every
// call arrives over IPC and is executed here against node:sqlite DatabaseSync.
// Files live under app.getPath('userData')/payload-local/.
import { app, ipcMain } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import crypto from 'node:crypto'

let DatabaseSync = null
let loadError = null
try {
  // Requires Electron/Node with the experimental node:sqlite module
  // (Node 22.5+ / recent Electron). Imported lazily so the message is clear.
  ({ DatabaseSync } = await import('node:sqlite'))
} catch (err) {
  loadError = err
}

function ensureDriver() {
  if (!DatabaseSync) {
    throw new Error(
      'node:sqlite (DatabaseSync) is unavailable. This host requires an ' +
        'Electron build bundling Node 22.5+ with the node:sqlite module. ' +
        `Original error: ${loadError ? loadError.message : 'unknown'}`,
    )
  }
}

// dbId -> { db, name, refCount }
const openDbs = new Map()
// name -> dbId (dedupe repeated opens of the same file)
const nameToId = new Map()

function sanitizeName(name) {
  const clean = String(name ?? '').replace(/[^A-Za-z0-9._-]/g, '_')
  if (!clean) throw new Error('invalid database name')
  return clean
}

// undefined -> null, boolean -> 1/0, everything else passthrough.
function mapParams(params) {
  return (params ?? []).map((p) => {
    if (p === undefined) return null
    if (typeof p === 'boolean') return p ? 1 : 0
    return p
  })
}

function getEntry(dbId) {
  const entry = openDbs.get(dbId)
  if (!entry) throw new Error('unknown dbId')
  return entry
}

function open(name) {
  ensureDriver()
  const safe = sanitizeName(name)

  const existingId = nameToId.get(safe)
  if (existingId) {
    const entry = openDbs.get(existingId)
    entry.refCount += 1
    return existingId
  }

  const dir = path.join(app.getPath('userData'), 'payload-local')
  fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, `${safe}.sqlite`)

  const db = new DatabaseSync(file)
  const dbId = crypto.randomUUID()
  openDbs.set(dbId, { db, name: safe, refCount: 1 })
  nameToId.set(safe, dbId)
  return dbId
}

function all(dbId, sql, params) {
  const { db } = getEntry(dbId)
  return db.prepare(sql).all(...mapParams(params))
}

function run(dbId, sql, params) {
  const { db } = getEntry(dbId)
  db.prepare(sql).run(...mapParams(params))
}

function setPragma(dbId, key, value) {
  const { db } = getEntry(dbId)
  if (!/^[A-Za-z_]+$/.test(String(key))) throw new Error('invalid pragma key')
  if (!/^[A-Za-z0-9_-]+$/.test(String(value))) throw new Error('invalid pragma value')
  db.exec(`PRAGMA ${key} = ${value}`)
}

function close(dbId) {
  const entry = getEntry(dbId)
  entry.refCount -= 1
  if (entry.refCount > 0) return
  entry.db.close()
  openDbs.delete(dbId)
  nameToId.delete(entry.name)
}

export function registerSqliteHost() {
  ipcMain.handle('sqlite:open', (_e, name) => open(name))
  ipcMain.handle('sqlite:all', (_e, dbId, sql, params) => all(dbId, sql, params))
  ipcMain.handle('sqlite:run', (_e, dbId, sql, params) => run(dbId, sql, params))
  ipcMain.handle('sqlite:setPragma', (_e, dbId, key, value) => setPragma(dbId, key, value))
  ipcMain.handle('sqlite:close', (_e, dbId) => close(dbId))
}
