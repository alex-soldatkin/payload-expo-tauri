// Window factory: the main renderer window plus the secondary web-admin window.
import { BrowserWindow } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const preloadPath = fileURLToPath(new URL('../preload/index.cjs', import.meta.url))

// Shared macOS window chrome (mirrors desktop-tauri tauri.conf.json).
const macChrome =
  process.platform === 'darwin'
    ? {
        vibrancy: 'sidebar',
        titleBarStyle: 'hiddenInset',
        trafficLightPosition: { x: 20, y: 20 },
        transparent: true,
        backgroundColor: '#00000000',
      }
    : {}

export function createMainWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    ...macChrome,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  const devUrl = process.env.ELECTRON_RENDERER_URL
  if (devUrl) {
    win.loadURL(devUrl)
  } else {
    win.loadFile(path.join(__dirname, '../../dist/index.html'))
  }

  return win
}

const DRAG_CSS = `
.app-header { -webkit-app-region: drag; }
.app-header a,
.app-header button,
.app-header input,
.app-header [role="button"] { -webkit-app-region: no-drag; }
`

let webAdminWindow = null

export function openWebAdminWindow(serverURL) {
  if (webAdminWindow && !webAdminWindow.isDestroyed()) {
    webAdminWindow.focus()
    return webAdminWindow
  }

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    ...macChrome,
  })
  webAdminWindow = win

  win.on('closed', () => {
    webAdminWindow = null
  })

  win.webContents.on('did-finish-load', () => {
    win.webContents.insertCSS(DRAG_CSS)
    win.webContents.executeJavaScript(
      "document.documentElement.classList.add('payload-tauri');",
    )
  })

  win.loadURL(new URL('/admin', serverURL).toString())
  return win
}
