/**
 * Responsive layout hook — provides device form factor and grid column count.
 *
 * Uses the shortest window dimension to detect tablets, which correctly
 * handles landscape phones (where width > 768 but height < 768).
 *
 * Breakpoints:
 *   shortSide >= 768 → tablet  (iPad Mini, iPad, iPad Pro)
 *   width >= 1024    → 3-column grid  (iPad landscape, iPad Pro portrait+)
 */
import { useWindowDimensions } from 'react-native'

/** Width of the sidebar navigation rendered on tablet. */
export const SIDEBAR_WIDTH = 280

export function useResponsive() {
  const { width, height } = useWindowDimensions()
  const shortSide = Math.min(width, height)
  const isTablet = shortSide >= 768
  const columns = width >= 1024 ? 3 : isTablet ? 2 : 1
  return { isTablet, columns, width, height }
}
