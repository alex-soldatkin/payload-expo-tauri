import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import { launchApp } from '../helpers/launch'
import { installSafety } from '../helpers/safety'
import { EDIT_ACTIONS } from '../helpers/manifest'
import {
  openList,
  waitForListReady,
  classifyOutcome,
  prepareForAction,
  clearToasts,
  dismissModal,
  openFirstDocEditor,
  type Outcome,
} from '../helpers/sweep'

/**
 * The passthrough EDIT-action sweep. For every collection that registers edit
 * passthrough actions (register.gen.ts → registerActionComponents(slug, 'edit',
 * [...])):
 *
 *   A. right-click the first list row → the doc context menu's
 *      `.doc-menu-passthrough` renders the edit action components; click each
 *      and assert an OUTCOME within 3s (confirm / modal+opaque / toast /
 *      blocked). Screenshot every opened modal.
 *   B. open the first doc's editor (dblclick) → open the ⋯ menu
 *      (`.doc-menu-trigger`) → assert the `.doc-menu-passthrough` entries render.
 *
 * Never clicks a modal's primary/destructive button. One describe per
 * collection; the Electron app is launched once and shared.
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

for (const entry of EDIT_ACTIONS) {
  test.describe(`edit passthrough — ${entry.slug}`, () => {
    test('A — right-click doc menu passthrough actions reach an outcome', async () => {
      test.setTimeout(120_000)
      await installSafety(page)
      await openList(page, entry.slug)
      const rows = await waitForListReady(page)
      if (rows === 0) {
        await expect(page.locator('.main-scroll .empty')).toBeVisible()
        test.info().annotations.push({
          type: 'skip-interaction',
          description: `${entry.slug}: 0 docs — no row to right-click`,
        })
        return
      }

      const row = page.locator('.list-row').first()
      const box = await row.boundingBox()
      expect(box).toBeTruthy()
      await row.click({ button: 'right', position: { x: 40, y: (box!.height / 2) | 0 } })

      const menu = page.locator('.doc-context-menu')
      await expect(menu).toBeVisible({ timeout: 10_000 })
      const passthrough = menu.locator('.doc-menu-passthrough')
      // The passthrough container renders when edit actions exist.
      await expect(passthrough).toBeVisible({ timeout: 5_000 })

      const clickables = passthrough.locator('button, [role="button"], .edit-menu-item')
      const n = await clickables.count()
      test.info().annotations.push({
        type: 'passthrough-count',
        description: `${entry.slug}: ${n} edit passthrough nodes / ${entry.components.length} registered`,
      })

      for (let i = 0; i < n; i++) {
        // The context menu closes on outside-click and on Escape; re-open it
        // before each action so a prior dismissal doesn't leave us clicking air.
        if ((await menu.count()) === 0 || !(await menu.isVisible().catch(() => false))) {
          await row.click({ button: 'right', position: { x: 40, y: (box!.height / 2) | 0 } })
          await expect(menu).toBeVisible({ timeout: 10_000 })
        }
        const clickable = passthrough.locator('button, [role="button"], .edit-menu-item').nth(i)
        if ((await clickable.count()) === 0) continue
        if (!(await clickable.isVisible().catch(() => false))) continue

        const label =
          ((await clickable.getAttribute('aria-label')) ||
            (await clickable.textContent()) ||
            `action${i}`)
            .trim()
            .replace(/[^a-z0-9]+/gi, '-')
            .toLowerCase()
            .slice(0, 40) || `action${i}`
        const tag = `${entry.slug}-edit-${label}`

        const toastBaseline = await prepareForAction(page)
        await clickable.click({ force: true }).catch(() => {})
        const outcome: Outcome = await classifyOutcome(page, tag, toastBaseline)
        test.info().annotations.push({
          type: 'outcome',
          description: `${entry.slug} edit "${label}" → ${outcome.kind} (${outcome.detail})`,
        })
        expect
          .soft(outcome.kind, `${entry.slug} edit action "${label}" produced no outcome in 3s`)
          .not.toBe('none')

        await dismissModal(page)
        await clearToasts(page)
      }
    })

    test('B — editor ⋯ menu renders passthrough entries', async () => {
      test.setTimeout(120_000)
      await installSafety(page)
      await openList(page, entry.slug)
      const rows = await waitForListReady(page)
      if (rows === 0) {
        test.info().annotations.push({
          type: 'skip-interaction',
          description: `${entry.slug}: 0 docs — no doc to open`,
        })
        return
      }

      // Open the first doc's editor; its ⋯ trigger lives in the doc header.
      await openFirstDocEditor(page)
      await page.locator('.doc-menu-trigger').click()

      const popover = page.locator('.doc-menu-popover')
      await expect(popover).toBeVisible({ timeout: 5_000 })
      // The passthrough entries render below the built-ins.
      const passthrough = popover.locator('.doc-menu-passthrough')
      await expect(passthrough).toBeVisible({ timeout: 5_000 })
      const n = await passthrough.locator('button, [role="button"], .edit-menu-item').count()
      test.info().annotations.push({
        type: 'passthrough-count',
        description: `${entry.slug} editor ⋯ menu: ${n} passthrough entries`,
      })
      expect(n).toBeGreaterThan(0)

      // Close the menu and go back to the list without mutating anything.
      await page.keyboard.press('Escape')
      const back = page.locator('.main-header .link', { hasText: 'Back' })
      if ((await back.count()) > 0) await back.first().click().catch(() => {})
    })
  })
}
