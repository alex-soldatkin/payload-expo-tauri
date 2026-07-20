import { defineConfig } from '@playwright/test'

/**
 * Playwright config for the Payload desktop Electron app.
 *
 * Modeled on assemblon's conventions (screenshots on, single project, list +
 * html reporters, artifacts under e2e/) but drives Electron via
 * `_electron.launch` instead of a Chromium webServer — there is no dev server
 * to boot; the built `dist/` renderer loads inside the Electron main process.
 *
 * A single project ('electron') runs serially (workers: 1): every test shares
 * one launched Electron instance/user-data dir, and the passthrough-modal
 * sweep is inherently sequential (open list → select row → click action).
 *
 * Point the app at the assemblon dev server with E2E_SERVER_URL (defaults to
 * http://localhost:3200). NEVER point it at 3050/3100 or the user's instance.
 */
export default defineConfig({
  testDir: './tests',
  // First-time RxDB sync of a large collection can take 30-60s; give tests room.
  timeout: 180_000,
  expect: { timeout: 15_000 },
  forbidOnly: !!process.env.CI,
  retries: 0,
  // One Electron instance, shared user-data dir → must run serially.
  workers: 1,
  fullyParallel: false,
  reporter: [['list'], ['html', { outputFolder: 'artifacts/html-report', open: 'never' }]],
  outputDir: 'artifacts/test-results',
  use: {
    // We take explicit modal screenshots ourselves; auto-capturing on every
    // test (and traces) bloats artifacts on a near-full disk. Keep both off.
    screenshot: 'off',
    trace: 'off',
    video: 'off',
  },
  projects: [{ name: 'electron' }],
})
