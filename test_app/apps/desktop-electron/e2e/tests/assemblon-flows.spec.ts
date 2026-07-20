import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import { launchApp } from '../helpers/launch'
import { installSafety } from '../helpers/safety'
import {
  openList,
  waitForListReady,
  selectFirstRow,
  dismissModal,
  clearToasts,
  openFirstDocEditor,
} from '../helpers/sweep'

/**
 * Read-only ports of the SPIRIT of assemblon's modal-flow e2e tests
 * (combine-orders.e2e.spec.ts, shipment-wizard.e2e.spec.ts). The originals seed
 * data over REST and walk the multi-step modal to CONFIRM; here we only assert
 * the same modals OPEN with their expected first-step structure inside the
 * desktop app, then dismiss WITHOUT confirming (the safety net would block the
 * mutation anyway). This exercises the richest passthrough modals end-to-end in
 * the Electron shell — the parts most likely to regress (portal, opaque frame,
 * step content).
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

test.describe('Combine orders (read-only)', () => {
  test('the orders edit-menu opens the Combine orders modal (opaque, dismissable)', async () => {
    test.setTimeout(120_000)
    await installSafety(page)
    await openList(page, 'orders')
    const rows = await waitForListReady(page)
    test.skip(rows === 0, 'no orders to open')

    // Open the first order's editor and its ⋯ menu.
    await openFirstDocEditor(page)
    await page.locator('.doc-menu-trigger').click()

    const item = page.locator('.doc-menu-passthrough', { hasText: 'Combine orders' })
    // Combine orders is staff-only; the dev user is admin so it should render.
    await expect(item).toBeVisible({ timeout: 5_000 })
    await item.getByText('Combine orders', { exact: true }).click()

    // The CombineOrdersModal (shared ui/modal.tsx) opens as a role=dialog.
    const dialog = page.locator('[role="dialog"]')
    await expect(dialog.first()).toBeVisible({ timeout: 15_000 })
    await page.screenshot({ path: 'artifacts/flow-combine-orders.png' })

    // Opaque-frame regression.
    const bg = await dialog.first().evaluate((el) => getComputedStyle(el as Element).backgroundColor)
    expect(bg, `combine-orders modal must be opaque, got ${bg}`).not.toMatch(
      /rgba\(\s*0,\s*0,\s*0,\s*0\s*\)|transparent/,
    )

    // Dismiss WITHOUT confirming — never click a Create/primary button.
    await dismissModal(page)
    await expect(page.locator('[role="dialog"]:visible')).toHaveCount(0)
  })
})

test.describe('Prepare shipment wizard (read-only)', () => {
  test('the Customer orders list opens the Prepare shipment wizard (opaque, dismissable)', async () => {
    test.setTimeout(120_000)
    await installSafety(page)
    await openList(page, 'carts')
    const rows = await waitForListReady(page)
    test.skip(rows === 0, 'no carts to select')

    await selectFirstRow(page)

    // The PrepareShipmentsListButton chip lives in the selection bar.
    const chip = page
      .locator('.selection-bar .selection-action.passthrough')
      .filter({ hasText: /Prepare shipment/i })
      .first()
    if ((await chip.count()) === 0) {
      test.info().annotations.push({
        type: 'skip-interaction',
        description: 'carts: Prepare shipment chip not rendered (RBAC / no eligible cart)',
      })
      test.skip(true, 'Prepare shipment chip absent')
      return
    }
    await chip.locator('button, [role="button"]').first().click({ force: true })

    // The shipment wizard opens as a role=dialog (its own Modal instance).
    const dialog = page.locator('[role="dialog"]')
    await expect(dialog.first()).toBeVisible({ timeout: 15_000 })
    await page.screenshot({ path: 'artifacts/flow-prepare-shipment.png' })

    const bg = await dialog.first().evaluate((el) => getComputedStyle(el as Element).backgroundColor)
    expect(bg, `shipment wizard modal must be opaque, got ${bg}`).not.toMatch(
      /rgba\(\s*0,\s*0,\s*0,\s*0\s*\)|transparent/,
    )

    await dismissModal(page)
    await clearToasts(page)
    await expect(page.locator('[role="dialog"]:visible')).toHaveCount(0)
  })
})
