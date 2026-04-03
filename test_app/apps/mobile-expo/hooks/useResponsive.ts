/**
 * Responsive layout hook — provides device form factor, orientation,
 * sidebar visibility, and grid column count.
 *
 * Key design decisions:
 *   - `isTablet` uses Platform.isPad (iOS) for reliable detection
 *     even in iPadOS Split View where window width can be phone-sized.
 *   - `showSidebar` is true only when the window is wide enough for a
 *     comfortable sidebar + content split (≥ 1024px). This means:
 *       • iPad landscape full-screen → sidebar
 *       • iPad portrait → bottom tabs
 *       • iPad split-view narrow → bottom tabs
 *       • Phone → bottom tabs
 *   - `columns` is computed from the *content area* width (after
 *     subtracting the sidebar), not the raw window width.
 */
import { Platform, useWindowDimensions } from 'react-native'

/** Width of the sidebar navigation. */
export const SIDEBAR_WIDTH = 280

export function useResponsive() {
  const { width, height } = useWindowDimensions()

  const isTablet = Platform.OS === 'ios' ? Platform.isPad === true : Math.min(width, height) >= 600
  const isLandscape = width > height

  // Show sidebar when there's enough room for sidebar + comfortable content (≥ 744px content)
  const showSidebar = isTablet && width >= 1024

  // Content area width = window width minus sidebar if shown
  const contentWidth = showSidebar ? width - SIDEBAR_WIDTH : width

  // Grid columns based on content area width
  // Keep 2 columns as max when sidebar is showing — 3 columns squeezes cards too tight
  const columns = showSidebar
    ? (contentWidth >= 600 ? 2 : 1)
    : (contentWidth >= 900 ? 3 : contentWidth >= 550 ? 2 : 1)

  return { isTablet, isLandscape, showSidebar, columns, contentWidth, width, height }
}
