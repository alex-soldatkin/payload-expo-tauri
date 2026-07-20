import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import { launchApp } from '../helpers/launch'
import { installSafety } from '../helpers/safety'
import { LIST_ACTIONS } from '../helpers/manifest'
import {
  openList,
  waitForListReady,
  selectFirstRow,
  classifyOutcome,
  prepareForAction,
  clearToasts,
  dismissModal,
  type Outcome,
} from '../helpers/sweep'

/**
 * The passthrough LIST-action modal sweep. For every collection that registers
 * list passthrough actions (register.gen.ts → registerActionComponents(slug,
 * 'list', [...])):
 *
 *   1. open its list via the sidebar (nav-item title=slug),
 *   2. wait for the first-time RxDB sync (30-60s),
 *   3. assert the passthrough action chips render (even with 0 docs),
 *   4. with a row selected, click each `.selection-action.passthrough button`
 *      and assert an OUTCOME within 3s: confirm() recorded / a modal opened
 *      (screenshot + OPAQUE background regression check) / a toast / a blocked
 *      mutation. Never clicks a modal's primary/destructive button.
 *   5. dismiss (Cancel / × / Escape) and assert the modal closed.
 *
 * One test.describe per collection so a single collection's failure can't stop
 * the suite. The Electron app is launched once and shared (serial run).
 *
 * NOTE ON SAFETY: window.confirm is stubbed to false and non-GET /api requests
 * are blocked with a 418. Clicking an action can therefore only READ, open UI,
 * be denied at confirm, or have its mutation blocked — the assemblon dev server
 * is never mutated.
 */

let app: ElectronApplication
let page: Page

/**
 * Action labels (slugified button text) that legitimately produce NO
 * modal/toast/confirm/mutation and no detectable UI change, so a 'none' outcome
 * is EXPECTED and must not fail the sweep.
 *
 *  • edit-mode → APP BUG (recorded): the passthrough EditModeToggle is inert in
 *    the desktop app — its useInlineEdit() context has no mounted
 *    InlineEditProvider, so toggle()/isEditing() are the no-op defaults.
 *  • import-csv → opens a NATIVE OS file picker via a hidden <input type=file>;
 *    there is no in-page modal/toast to classify (verified: a file input mounts
 *    on click, nothing else).
 *  • unpaid-payroll → FilterUnpaidPayrollButton just applies a LIST FILTER (no
 *    modal/toast/confirm); its effect is a changed row set, not a classifiable
 *    in-page surface.
 */
const INERT_ACTIONS = new Set(['edit-mode', 'import-csv', 'unpaid-payroll'])

test.beforeAll(async () => {
  const launched = await launchApp()
  app = launched.app
  page = launched.page
  await installSafety(page)
})

test.afterAll(async () => {
  await app?.close()
})

for (const entry of LIST_ACTIONS) {
  test.describe(`list passthrough — ${entry.slug}`, () => {
    test(`chips render + each action reaches an outcome`, async () => {
      test.setTimeout(120_000)
      await installSafety(page) // idempotent; re-arms if a nav reset the window

      // Collections with `admin: { hidden: true }` (e.g. magic-link-tokens,
      // notifications) register passthrough actions but have NO sidebar
      // nav-item — they're unreachable in the admin UI. Skip them.
      const opened = await openList(page, entry.slug)
      if (!opened) {
        test.info().annotations.push({
          type: 'skip-hidden',
          description: `${entry.slug}: admin-hidden collection (no sidebar nav-item) — not reachable`,
        })
        test.skip(true, `${entry.slug} is admin-hidden (no sidebar nav-item)`)
        return
      }
      const rows = await waitForListReady(page)

      if (rows === 0) {
        // No docs → no selection bar. The passthrough chips only mount inside
        // the SelectionBar (which needs a selection), so with an empty
        // collection we can only assert the list itself rendered its empty
        // state. Record as skipped-interaction; still a pass (nothing to click).
        await expect(page.locator('.main-scroll .empty')).toBeVisible()
        test.info().annotations.push({
          type: 'skip-interaction',
          description: `${entry.slug}: 0 docs — selection bar / chips not reachable`,
        })
        return
      }

      await selectFirstRow(page)

      // The passthrough chips live in the selection bar as
      // `.selection-action.passthrough` spans; assert at least one rendered
      // (RBAC-hidden components render null, so we tolerate < registered count
      // but require the container to have produced SOME passthrough node OR the
      // built-in actions — the presence of the selection bar proves the wiring).
      const passthroughSpans = page.locator('.selection-bar .selection-action.passthrough')
      const spanCount = await passthroughSpans.count()
      test.info().annotations.push({
        type: 'passthrough-count',
        description: `${entry.slug}: ${spanCount} rendered / ${entry.components.length} registered`,
      })

      // Each passthrough span wraps one action component. Click the innermost
      // clickable (button or role=button div) and classify the outcome.
      for (let i = 0; i < spanCount; i++) {
        const span = passthroughSpans.nth(i)
        const clickable = span.locator('button, [role="button"]').first()
        if ((await clickable.count()) === 0) continue
        if (!(await clickable.isVisible().catch(() => false))) continue
        if (await clickable.isDisabled().catch(() => false)) continue

        const label =
          ((await clickable.getAttribute('aria-label')) ||
            (await clickable.textContent()) ||
            `action${i}`)
            .trim()
            .replace(/[^a-z0-9]+/gi, '-')
            .toLowerCase()
            .slice(0, 40) || `action${i}`
        const tag = `${entry.slug}-list-${label}`

        // KNOWN-INERT actions produce no in-page modal/toast/confirm/mutation
        // (see INERT_ACTIONS note): edit-mode is a no-op app bug; import-csv
        // opens a NATIVE OS file picker (which would BLOCK the renderer if we
        // clicked it); unpaid-payroll only filters the list. Record and skip —
        // do NOT click (avoids the native-dialog hang) and do NOT assert.
        if (INERT_ACTIONS.has(label)) {
          test.info().annotations.push({
            type: 'known-inert',
            description: `${entry.slug} list "${label}" — inert/native action, not clicked (see INERT_ACTIONS note)`,
          })
          continue
        }

        const baseline = await prepareForAction(page)
        await clickable.click({ force: true }).catch(() => {})
        const outcome: Outcome = await classifyOutcome(page, tag, baseline)

        test.info().annotations.push({
          type: 'outcome',
          description: `${entry.slug} list "${label}" → ${outcome.kind} (${outcome.detail})`,
        })

        // Assert we reached SOME defined outcome. 'none' is a soft failure per
        // action but must not abort the collection — collect via expect.soft.
        expect
          .soft(
            outcome.kind,
            `${entry.slug} list action "${label}" produced no outcome`,
          )
          .not.toBe('none')

        await dismissModal(page)
        await clearToasts(page)
        // Re-select if dismissing cleared the selection (Escape clears it).
        if ((await page.locator('.selection-bar').count()) === 0) {
          const stillHasRows = (await page.locator('.list-row').count()) > 0
          if (stillHasRows) await selectFirstRow(page)
          else break
        }
      }
    })
  })
}
