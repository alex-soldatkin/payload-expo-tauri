/**
 * Constants + tuning curves shared by the overlay panel and its nav content.
 */

export const ACTIVE_COLOR = '#007AFF'
export const INACTIVE_COLOR = '#8E8E93'

/** Width of the logical left-edge capture strip (pt). */
export const EDGE_WIDTH = 24
/** Overlay panel width — ~300pt, capped for narrow phones. */
export const MAX_PANEL_WIDTH = 300

/**
 * Tab ROOT pathnames where the edge-open gesture is armed. Anything deeper
 * (e.g. '/collections/posts') leaves the left edge to the system back-swipe.
 */
export const TAB_ROOT_PATHS = new Set(['/', '/collections', '/globals', '/account'])

// Spring curves tuned to feel like the UIKit sheet presentation
export const SPRING = { damping: 26, stiffness: 300, mass: 0.9, useNativeDriver: true } as const

/** iOS-style rubber band: diminishing returns as the overdrag grows. */
export const rubberBand = (overdrag: number, dimension: number): number =>
  (1 - 1 / ((overdrag * 0.55) / dimension + 1)) * dimension * 0.5
