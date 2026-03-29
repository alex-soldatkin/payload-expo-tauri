# Tauri desktop UI chrome + sidebar blur worklog (2026-02-05)

This file documents, in detail, the changes made to the desktop/Tauri UI chrome and sidebar blur behavior, plus the current state and outstanding issues.

## Goals (as requested)
- Make the desktop admin feel like a native app window:
  - Hamburger, breadcrumbs, and account/avatar in a top bar near window controls.
  - Sidebar is translucent/blurry and feels distinct from main content.
  - Sidebar slides in/out from the left; no fade-in/fade-out.
  - Sidebar should feel “below” main content (not overlaying it), yet reveal the OS windows behind (true transparency / vibrancy).
  - Title should be dynamic (based on page title).
  - Native window drag on title bar + double-click to maximize should work.

## Current state (observed by user)
- **Main content no longer squashed.**
- **Titlebar looks better** (spacing improved), but hamburger is not placed next to native window controls exactly as desired.
- **Window drag + resize now works**, but **titlebar drag/double-click maximize still problematic earlier** (fixed later with JS handler).
- **Sidebar blur/vibrancy is now visible**; OS windows show through the app.

## Files changed

### 1) Tauri config
**Path:** `test_app/apps/desktop-tauri/src-tauri/tauri.conf.json`

Changes applied:
- Enabled overlay titlebar and custom traffic light position:
  - `titleBarStyle: "Overlay"`
  - `trafficLightPosition: { x: 12, y: 12 }`
- Enabled transparency and hidden title:
  - `transparent: true`
  - `hiddenTitle: true`
- Added transparent background color:
  - `backgroundColor: "#00000000"`
- Added window effects:
  - `windowEffects: { effects: ["sidebar"], state: "active" }`
- Enabled macOS private APIs:
  - `macOSPrivateApi: true`

Purpose:
- Overlay titlebar allows the webview to extend under the titlebar.
- Transparent window + effects is the required base for macOS vibrancy.

### 2) Tauri permissions
**Path:** `test_app/apps/desktop-tauri/src-tauri/capabilities/default.json`

Changes applied:
- Added window permissions:
  - `core:window:default`
  - `core:window:allow-set-background-color`
  - `core:window:allow-set-effects`
  - `core:window:allow-start-dragging`
  - `core:window:allow-toggle-maximize`

Purpose:
- Allow JS to call `startDragging()` and `toggleMaximize()`.

### 3) Tauri Rust features
**Path:** `test_app/apps/desktop-tauri/src-tauri/Cargo.toml`

Changes applied:
- Enabled macOS private API:
  - `tauri = { version = "2.1", features = ["macos-private-api"] }`
- Added macOS vibrancy helper:
  - `window-vibrancy = "0.6.0"` (macOS target dependency)

Purpose:
- Required for macOS transparency / vibrancy support.

### 3b) Tauri Rust startup
**Path:** `test_app/apps/desktop-tauri/src-tauri/src/main.rs`

Changes applied:
- Added a Tauri `setup` hook to apply macOS vibrancy on the `main` window:
  - `apply_vibrancy(..., NSVisualEffectMaterial::Sidebar, NSVisualEffectState::Active, ...)`

Purpose:
- Ensure vibrancy is applied at startup (prevents the webview from appearing opaque).

### 4) JS bridge for Tauri menu + titlebar behavior
**Path:** `test_app/apps/server/src/app/(payload)/tauri/TauriMenuBridge.tsx`

Key changes:
- Adds a `payload-tauri` class to `<html>` for targeted styling.
- Sets window effects at runtime:
  - `appWindow.setEffects({ effects: [Effect.Sidebar], state: EffectState.Active })`
- Sets transparent window background at runtime:
  - `appWindow.setBackgroundColor([0, 0, 0, 0])`
- Implements drag + double-click maximize on the header:
  - Attaches `mousedown` handler on `.app-header`.
  - Ignores clicks on interactive elements (`a`, `button`, form inputs, etc.).
  - Uses `appWindow.startDragging()` for drag.
  - Uses `appWindow.toggleMaximize()` on double-click.
  - `mousedown` + `dblclick` now attach with capture to avoid UI swallowing events.
- Dynamic title injection:
  - Observes `<title>` changes with `MutationObserver`.
  - Updates `data-title` on `.step-nav__home`.

Purpose:
- Make title bar draggable and maximizable without relying on a dedicated drag overlay.
- Ensure title text in top bar updates with page title changes.
- Apply window effects after startup, not only via config.

### 5) UI styling / layout
**Path:** `test_app/apps/server/src/app/(payload)/custom.scss`

Key styling changes:
- Global transparency:
  - `html`, `body`, `.template-default`, `.template-default__wrap` background set to `transparent` (with `!important`).
  - `.template-default__wrap::before` set to `transparent`.
- Titlebar layout:
  - Increased left padding: `--titlebar-left-pad: 140px`.
  - Placed hamburger near window controls:
    - `--titlebar-hamburger-left: 88px`
    - `.app-header__mobile-nav-toggler` positioned `absolute` in header.
  - Reordered header elements:
    - Step nav left, actions center, account right.
- Header styling:
  - Transparent header background + blur.
  - `isolation: isolate` to layer drag region and controls.
- Step nav formatting:
  - Inline flex, no trailing gradient.
  - `data-title` used for “Payload Admin” label.
- Sidebar styling:
  - `position: sticky`, left column.
  - `::before` overlay with blur (`backdrop-filter` + `-webkit-backdrop-filter`).
  - Sliding behavior via `transform: translateX(-var(--nav-width))` and open state transforms.
- Layout grid:
  - `template-default` grid set to `0 minmax(0, 1fr)` and `var(--nav-width)` when open.

Purpose:
- Position the header controls in the macOS titlebar area.
- Make the sidebar translucent and sliding.
- Avoid squashing the main content area.

## Observed behavior / issues

### A) Blur/vibrancy
- **Resolved** after:
  - Enabling `macOSPrivateApi` in `tauri.conf.json`
  - Enabling `macos-private-api` in `Cargo.toml`
  - Applying `window-vibrancy` in Rust `setup`
  - Forcing transparent backgrounds in `custom.scss`

### B) Titlebar drag/double-click
- Drag and double-click maximize are working after using capture listeners on the header.

### C) Hamburger placement
- Hamburger is now absolute-positioned near the traffic lights, but exact spacing still not finalized.

## Hypotheses for missing blur (not yet implemented)
**Note:** This section is speculative; no further changes were made after user request to stop.

Potential reasons:
1) **macOS “Reduce transparency” setting** is enabled, which disables vibrancy in apps. (NO, it is disabled, ive checked)
2) **Main content background is still opaque** (some internal layers or wrappers might still set `background-color` and cover the transparent window).
3) **Window effect doesn’t apply to webview** unless specific view types are used or webview background is set to transparent via Tauri APIs.
4) **Payload’s own layout** might be enforcing background on child wrappers or `:root` CSS variables that override transparency.

## What works
- Desktop app loads the real Payload Admin UI.
- Native menu generation works.
- Titlebar content is rendered in top bar with custom spacing and dynamic title updates.
- Sidebar grouping works via custom nav component.
- Drag/resize + double-click maximize works via JS handler.
- Sidebar blur/vibrancy works.

## What does not work yet
- Titlebar spacing still not final per user feedback.

## Commands used during iteration
- `pnpm -C test_app dev:desktop`
- `pnpm -C test_app dev:server`

## Relevant code locations
- `test_app/apps/desktop-tauri/src-tauri/tauri.conf.json`
- `test_app/apps/desktop-tauri/src-tauri/Cargo.toml`
- `test_app/apps/desktop-tauri/src-tauri/capabilities/default.json`
- `test_app/apps/server/src/app/(payload)/tauri/TauriMenuBridge.tsx`
- `test_app/apps/server/src/app/(payload)/custom.scss`
- `test_app/apps/server/src/components/NativeNav/index.tsx` (custom nav component)

## Summary
The UI chrome has been heavily customized (titlebar layout, nav positioning, sliding behavior). **True translucency/vibrancy is now working** after enabling macOS private APIs, applying window vibrancy in Rust, and forcing transparent backgrounds in CSS. Titlebar drag behavior was re-implemented in JS with capture listeners and now works, but spacing still needs fine‑tuning.
