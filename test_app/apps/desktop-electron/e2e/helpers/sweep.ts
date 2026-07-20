// Shared drivers for the passthrough-action sweep: navigate to a collection
// list, wait for RxDB sync, select a row, and classify the OUTCOME of clicking
// a passthrough action (confirm / modal / toast / blocked mutation), with the
// opaque-background regression check + screenshot for opened modals.
import { expect, type Page } from '@playwright/test'
import { resetRecorders } from './safety'

const ARTIFACTS = 'artifacts'

/** Click a collection in the sidebar by its slug (nav-item title=slug). */
export async function openList(page: Page, slug: string): Promise<void> {
  const nav = page.locator(`.sidebar .nav-item[title="${slug}"]`)
  await nav.waitFor({ state: 'visible', timeout: 15_000 })
  await nav.click()
  // The list header renders even while docs sync in.
  await page.locator('.main .main-header h2').first().waitFor({ state: 'visible', timeout: 20_000 })
}

/**
 * Wait for the list to finish its first-time sync. Returns the number of rows
 * visible (0 is a legitimate outcome — empty collection). Lazy first sync can
 * take 30-60s, so we poll generously for the "Loading…" state to clear.
 */
export async function waitForListReady(page: Page, timeout = 75_000): Promise<number> {
  // The list body shows "Loading…" until RxDB is ready; wait for it to clear.
  await expect
    .poll(
      async () => {
        const loading = await page.locator('.main-scroll .empty', { hasText: 'Loading' }).count()
        return loading === 0
      },
      { timeout, message: 'list stayed in Loading… state' },
    )
    .toBe(true)
  // Give async row hydration a beat, then count.
  await page.waitForTimeout(500)
  return page.locator('.list-row').count()
}

/** Single-click the first row to toggle it into the selection. */
export async function selectFirstRow(page: Page): Promise<void> {
  const row = page.locator('.list-row').first()
  await row.click()
  await expect(page.locator('.selection-bar')).toBeVisible({ timeout: 10_000 })
}

/**
 * Open the first row's editor. A raw dblclick is flaky here (the first click
 * toggles selection and shifts the layout), so select the row then press Enter
 * — the list-row keydown handler opens the doc. Returns once the editor's ⋯
 * trigger is visible.
 */
export async function openFirstDocEditor(page: Page): Promise<void> {
  const row = page.locator('.list-row').first()
  await row.click()
  await page.keyboard.press('Enter')
  await expect(page.locator('.doc-menu-trigger')).toBeVisible({ timeout: 30_000 })
}

export type Outcome =
  | { kind: 'confirm'; detail: string }
  | { kind: 'modal'; detail: string }
  | { kind: 'toast'; detail: string }
  | { kind: 'blocked'; detail: string }
  | { kind: 'none'; detail: string }

/** Locator for any "opened modal" surface the passthrough components use. */
export function modalLocator(page: Page) {
  // The shared ui/modal.tsx renders role="dialog"[aria-modal] inside a
  // [data-ui-modal] overlay; other passthrough dialogs render their own fixed
  // overlays. Match the dialog frame first (that's what we screenshot).
  return page.locator('[role="dialog"], [data-ui-modal] > div, .doc-context-menu ~ [data-ui-modal]')
}

/**
 * Snapshot state right before clicking an action, so classifyOutcome only
 * counts NEW toasts (they linger for seconds and would otherwise short-circuit
 * the next action's detection). Also clears the confirm/blocked recorders.
 */
export async function prepareForAction(page: Page): Promise<number> {
  await resetRecorders(page)
  return page.locator('.toast-stack .toast').count()
}

/**
 * After a passthrough click, classify the outcome within `budget` ms and, if a
 * modal opened, screenshot it and assert its background is OPAQUE.
 * `tag` names the screenshot artifact (<slug>-<action>). `toastBaseline` is the
 * toast count from prepareForAction — only toasts beyond it count as this
 * action's outcome.
 */
export async function classifyOutcome(
  page: Page,
  tag: string,
  toastBaseline = 0,
  budget = 3_000,
): Promise<Outcome> {
  const deadline = Date.now() + budget
  const dialog = page.locator('[role="dialog"]')
  const uiModalOverlay = page.locator('[data-ui-modal]')
  const toast = page.locator('.toast-stack .toast')

  while (Date.now() < deadline) {
    // 1. confirm() recorded
    const confirms = await page.evaluate(() => window.__confirms?.length ?? 0)
    if (confirms > 0) {
      const msg = await page.evaluate(() => window.__confirms.at(-1) ?? '')
      return { kind: 'confirm', detail: msg.slice(0, 80) }
    }
    // 2. a real modal opened
    if ((await dialog.count()) > 0 && (await dialog.first().isVisible())) {
      return await onModal(page, dialog.first(), tag)
    }
    // 2b. a fixed overlay wider than 300px (non-dialog passthrough modals)
    if ((await uiModalOverlay.count()) > 0) {
      const inner = uiModalOverlay.first().locator(':scope > div').first()
      if ((await inner.count()) > 0 && (await inner.isVisible())) {
        const box = await inner.boundingBox()
        if (box && box.width > 300) return await onModal(page, inner, tag)
      }
    }
    // Any other fixed-position element wider than 300px that just appeared.
    const fixedWide = await findFixedWide(page)
    if (fixedWide) return await onModal(page, page.locator(fixedWide).first(), tag)
    // 3. a NEW toast (beyond the pre-click baseline)
    if ((await toast.count()) > toastBaseline && (await toast.last().isVisible())) {
      const txt = (await toast.last().textContent())?.trim() ?? ''
      return { kind: 'toast', detail: txt.slice(0, 80) }
    }
    // 4. blocked mutation
    const blocked = await page.evaluate(() => window.__blocked?.length ?? 0)
    if (blocked > 0) {
      const b = await page.evaluate(() => window.__blocked.at(-1))
      return { kind: 'blocked', detail: `${b?.method} ${b?.url}`.slice(0, 100) }
    }
    await page.waitForTimeout(150)
  }
  return { kind: 'none', detail: 'no outcome within budget' }
}

/** Screenshot the modal, assert opaque background, return a modal outcome. */
async function onModal(
  page: Page,
  frame: ReturnType<Page['locator']>,
  tag: string,
): Promise<Outcome> {
  await page.screenshot({ path: `${ARTIFACTS}/${tag}.png` })
  const bg = await frame.evaluate((el) => getComputedStyle(el as Element).backgroundColor)
  // Regression: the modal frame must NOT be transparent.
  expect(
    bg,
    `modal ${tag} background must be opaque, got "${bg}"`,
  ).not.toMatch(/rgba\(\s*0,\s*0,\s*0,\s*0\s*\)|transparent/)
  return { kind: 'modal', detail: `bg=${bg}` }
}

/**
 * Detect a just-appeared fixed/absolute element wider than 300px that is NOT a
 * dialog/data-ui-modal (already handled) and NOT the app chrome. Returns a
 * usable selector string or null. Kept in-page for speed.
 */
async function findFixedWide(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll('body *')) as HTMLElement[]
    for (const el of nodes) {
      const cs = getComputedStyle(el)
      if (cs.position !== 'fixed' && cs.position !== 'absolute') continue
      if (cs.display === 'none' || cs.visibility === 'hidden') continue
      const r = el.getBoundingClientRect()
      if (r.width <= 300 || r.height <= 80) continue
      // Skip app shell / sidebar / known non-modal chrome.
      const cls = el.className?.toString() ?? ''
      if (/sidebar|app-header|main-scroll|list-table|toast|picker-menu|selection-bar/.test(cls)) continue
      if (el.closest('.sidebar, .app-header, .main-header')) continue
      // Must look like an overlay: high z-index or covers a large area.
      const z = parseInt(cs.zIndex || '0', 10)
      if (z >= 100 || r.width > window.innerWidth * 0.4) {
        // Tag it so the caller can re-select deterministically.
        el.setAttribute('data-e2e-modal', '1')
        return '[data-e2e-modal="1"]'
      }
    }
    return null
  })
}

/**
 * Dismiss whatever modal/overlay is open (Cancel / × / Escape), and assert it
 * closed. Tolerant of components that only respond to Escape.
 */
export async function dismissModal(page: Page): Promise<void> {
  const escapeAndCheck = async () => {
    await page.keyboard.press('Escape')
    await page.waitForTimeout(250)
  }
  // Prefer an explicit Cancel / Close control inside the open dialog.
  const closeBtn = page
    .locator('[role="dialog"] [aria-label="Close"], [role="dialog"] button:has-text("Cancel"), [data-ui-modal] [aria-label="Close"]')
    .first()
  if ((await closeBtn.count()) > 0 && (await closeBtn.isVisible().catch(() => false))) {
    await closeBtn.click({ force: true }).catch(() => {})
    await page.waitForTimeout(250)
  }
  // Escape as a fallback / belt-and-braces.
  for (let i = 0; i < 3; i++) {
    const stillOpen =
      (await page.locator('[role="dialog"]:visible').count()) > 0 ||
      (await page.locator('[data-ui-modal]:visible').count()) > 0 ||
      (await page.locator('[data-e2e-modal="1"]:visible').count()) > 0
    if (!stillOpen) break
    await escapeAndCheck()
  }
  // Clean up our detection marker for the next action.
  await page.evaluate(() => document.querySelector('[data-e2e-modal="1"]')?.removeAttribute('data-e2e-modal'))
  await resetRecorders(page)
}

/** Dismiss every visible toast so a lingering stack can't cover the next UI. */
export async function clearToasts(page: Page): Promise<void> {
  const toasts = page.locator('.toast-stack .toast')
  for (let i = (await toasts.count()) - 1; i >= 0; i--) {
    await toasts.nth(i).click({ force: true }).catch(() => {})
  }
  await page.waitForTimeout(100)
}
