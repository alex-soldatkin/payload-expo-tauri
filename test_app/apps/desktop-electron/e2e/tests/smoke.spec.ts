import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import { launchApp } from '../helpers/launch'
import { installSafety, readBlocked } from '../helpers/safety'

/**
 * Smoke test: the app boots, signs in against the assemblon dev server, the
 * sidebar renders collections, and the safety net is live (a mutation attempt
 * is blocked, not sent). Guards the whole harness before the modal sweep runs.
 */
let app: ElectronApplication
let page: Page

test.beforeAll(async () => {
  const launched = await launchApp()
  app = launched.app
  page = launched.page
  await installSafety(page)
})

test.afterAll(async () => {
  await app?.close()
})

test('boots to workspace with a populated sidebar', async () => {
  await expect(page.locator('.sidebar')).toBeVisible()
  const navItems = page.locator('.sidebar .nav-item')
  await expect.poll(() => navItems.count(), { timeout: 30_000 }).toBeGreaterThan(3)
})

test('safety net blocks a non-GET /api mutation', async () => {
  const status = await page.evaluate(async () => {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
    return res.status
  })
  expect(status).toBe(418)
  const blocked = await readBlocked(page)
  expect(blocked.some((b) => b.method === 'POST' && b.url.includes('/api/orders'))).toBe(true)
})

test('safety net lets GET /api reads through', async () => {
  // A GET must NOT be recorded as blocked (reads/sync must work).
  const before = (await readBlocked(page)).length
  await page.evaluate(() => fetch('/api/users/me').catch(() => {}))
  const after = (await readBlocked(page)).length
  expect(after).toBe(before)
})
