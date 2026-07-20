// In-page safety net installed into the live renderer after launch.
//
// Two guarantees so the passthrough-modal sweep can NEVER mutate the assemblon
// dev server or fire a native confirm that blocks the run:
//
//  1. window.confirm is stubbed to return false (deny) — passthrough actions
//     gated behind confirm() therefore no-op. A test can opt in per-call via
//     window.__allowConfirmOnce() (returns true exactly once) when it needs to.
//     Every confirm() call is recorded on window.__confirms for outcome checks.
//
//  2. fetch is wrapped to BLOCK any non-GET request whose URL contains '/api'
//     (i.e. server mutations), answering with a synthetic 418 JSON response and
//     recording {method,url} on window.__blocked. GET requests (reads, list
//     sync) pass through untouched. Non-/api requests pass through too.
//
// This is injected via page.evaluate (not addInitScript) because the Electron
// app is already booted by the launch helper by the time a test runs; the
// renderer keeps one long-lived window, so patching it live is sufficient and
// survives in-app navigation (no full reloads).
import type { Page } from '@playwright/test'

declare global {
  interface Window {
    __blocked: Array<{ method: string; url: string }>
    __confirms: string[]
    __safetyInstalled?: boolean
    __allowConfirmOnce: () => void
  }
}

export async function installSafety(page: Page): Promise<void> {
  await page.evaluate(() => {
    if (window.__safetyInstalled) return
    window.__safetyInstalled = true
    window.__blocked = []
    window.__confirms = []

    let allowNext = false
    window.__allowConfirmOnce = () => {
      allowNext = true
    }
    window.confirm = (message?: string): boolean => {
      window.__confirms.push(String(message ?? ''))
      if (allowNext) {
        allowNext = false
        return true
      }
      return false
    }

    const realFetch = window.fetch.bind(window)
    window.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : (input as Request).url
      const method = (
        init?.method ??
        (input instanceof Request ? input.method : 'GET')
      ).toUpperCase()
      const isMutation = method !== 'GET' && method !== 'HEAD'
      if (isMutation && /\/api(\/|\?|$)/.test(url)) {
        window.__blocked.push({ method, url })
        return Promise.resolve(
          new Response(JSON.stringify({ blocked: true, reason: 'e2e-safety' }), {
            status: 418,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }
      return realFetch(input as RequestInfo, init)
    }
  })
}

/** Snapshot of blocked mutations recorded so far. */
export function readBlocked(page: Page): Promise<Array<{ method: string; url: string }>> {
  return page.evaluate(() => window.__blocked ?? [])
}

/** Snapshot of confirm() messages recorded so far. */
export function readConfirms(page: Page): Promise<string[]> {
  return page.evaluate(() => window.__confirms ?? [])
}

/** Reset the recorders between actions so outcome checks are per-action. */
export async function resetRecorders(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.__blocked = []
    window.__confirms = []
  })
}
