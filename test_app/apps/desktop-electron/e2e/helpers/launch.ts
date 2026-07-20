// Launch + auth helper for the Payload desktop Electron app.
//
// Mirrors the SPIRIT of assemblon's auth fixtures (a reusable login that yields
// an authenticated app at the workspace) but for Electron: we boot the built
// app via `_electron.launch`, drive the first-run Connect → Login flow, and
// wait for the sidebar. On a fresh user-data dir the app shows the ConnectScreen
// (no serverURL); if a serverURL is already persisted it shows the LoginScreen
// with a "change server" link — we handle both.
//
// CRITICAL: strip ELECTRON_RUN_AS_NODE from the child env. Playwright's own
// runner is an Electron/Node process that may export it; if it leaks through,
// the launched app runs as a bare Node process (no BrowserWindow) and the
// launch hangs.
import { _electron as electron, type ElectronApplication, type Page, expect } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// e2e/helpers → app root (apps/desktop-electron)
const APP_ROOT = path.resolve(__dirname, '..', '..')

export const SERVER_URL = process.env.E2E_SERVER_URL || 'http://localhost:3200'
export const DEV_EMAIL = process.env.E2E_EMAIL || 'dev@assemblon.local'
export const DEV_PASSWORD = process.env.E2E_PASSWORD || 'assemblon-dev-1234'
// Isolated user-data dir so we never touch the user's real instance. A FIXED
// (not timestamped) path, reused across launches within a run: the app's local
// RxDB SQLite lives here, so a per-launch fresh path would (a) re-sync the whole
// assemblon DB every time and (b) accumulate multi-GB copies on disk. We wipe it
// once at process start (see resetUserData) to still get the first-run flow.
export const USER_DATA_DIR = process.env.E2E_UDD || '/tmp/e2e-pw-udd'

export type LaunchedApp = {
  app: ElectronApplication
  page: Page
}

/**
 * Boot the built Electron app, sign in against the configured server, and
 * return once the workspace sidebar is visible.
 */
export async function launchApp(): Promise<LaunchedApp> {
  const env: Record<string, string> = {}
  for (const [k, v] of Object.entries(process.env)) {
    if (v !== undefined) env[k] = v
  }
  // MUST strip — see file header.
  delete env.ELECTRON_RUN_AS_NODE

  const app = await electron.launch({
    args: ['.', `--user-data-dir=${USER_DATA_DIR}`],
    cwd: APP_ROOT,
    env,
    timeout: 60_000,
  })

  const page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')

  await signIn(page)

  return { app, page }
}

/** Drive Connect (if shown) → Login → wait for the workspace sidebar. */
async function signIn(page: Page): Promise<void> {
  // Wait for the boot screen to resolve into Connect or Login.
  await page
    .locator('#server-url, #email, .sidebar')
    .first()
    .waitFor({ state: 'visible', timeout: 45_000 })

  // Already at the workspace (reused user-data)? Nothing to do.
  if (await page.locator('.sidebar').count()) return

  // ConnectScreen: a fresh user-data dir has no serverURL.
  if (await page.locator('#server-url').count()) {
    await setServer(page)
  } else if (await page.locator('.card .link', { hasText: 'change server' }).count()) {
    // LoginScreen with a stale serverURL → open Connect and re-set it.
    await page.getByRole('button', { name: 'change server' }).click()
    await page.locator('#server-url').waitFor({ state: 'visible', timeout: 15_000 })
    await setServer(page)
  }

  // LoginScreen.
  await page.locator('#email').waitFor({ state: 'visible', timeout: 20_000 })
  await page.fill('#email', DEV_EMAIL)
  await page.fill('#password', DEV_PASSWORD)
  await page.getByRole('button', { name: /Sign in/ }).click()

  // Workspace ready. A cold first run fetches the admin schema and initializes
  // the local RxDB before the sidebar mounts — give it room. Surface a login
  // error box early instead of waiting out the whole timeout.
  await Promise.race([
    page.locator('.sidebar').waitFor({ state: 'visible', timeout: 150_000 }),
    page
      .locator('.error-box')
      .waitFor({ state: 'visible', timeout: 150_000 })
      .then(async () => {
        const msg = await page.locator('.error-box').first().textContent()
        throw new Error(`Sign-in surfaced an error: ${msg?.trim()}`)
      }),
  ])
  await expect(page.locator('.sidebar')).toBeVisible()
}

async function setServer(page: Page): Promise<void> {
  const input = page.locator('#server-url')
  await input.fill(SERVER_URL)
  await page.getByRole('button', { name: 'Continue' }).click()
}
