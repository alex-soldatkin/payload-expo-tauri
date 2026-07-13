// Dev orchestrator: start the Vite dev server, wait for it to respond, then
// launch Electron pointed at it. Kill Vite when Electron exits.
import { spawn } from 'node:child_process'
import http from 'node:http'

const DEV_URL = 'http://localhost:5183'
const MAX_WAIT_MS = 30_000
const POLL_INTERVAL_MS = 300

const isWindows = process.platform === 'win32'

function spawnBin(bin, args, extraEnv) {
  const env = { ...process.env, ...extraEnv }
  // Inherited from Electron-derived terminals (VS Code etc.); would make the
  // electron binary run our main as plain Node and fail on import 'electron'.
  delete env.ELECTRON_RUN_AS_NODE
  return spawn(bin, args, {
    stdio: 'inherit',
    shell: isWindows,
    env,
  })
}

function ping(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume()
      resolve(true)
    })
    req.on('error', () => resolve(false))
    req.setTimeout(1000, () => {
      req.destroy()
      resolve(false)
    })
  })
}

async function waitForServer() {
  const deadline = Date.now() + MAX_WAIT_MS
  while (Date.now() < deadline) {
    if (await ping(DEV_URL)) return true
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
  }
  return false
}

async function main() {
  const vite = spawnBin('vite', [])
  let electron = null
  let shuttingDown = false

  const shutdown = (code) => {
    if (shuttingDown) return
    shuttingDown = true
    if (electron && electron.exitCode === null) electron.kill()
    if (vite.exitCode === null) vite.kill()
    process.exit(code ?? 0)
  }

  process.on('SIGINT', () => shutdown(0))
  process.on('SIGTERM', () => shutdown(0))

  vite.on('exit', (code) => {
    if (!shuttingDown) shutdown(code ?? 0)
  })

  const ready = await waitForServer()
  if (!ready) {
    console.error(`[dev] Vite did not respond at ${DEV_URL} within ${MAX_WAIT_MS}ms`)
    shutdown(1)
    return
  }

  electron = spawnBin('electron', ['.'], { ELECTRON_RENDERER_URL: DEV_URL })
  electron.on('exit', (code) => shutdown(code ?? 0))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
