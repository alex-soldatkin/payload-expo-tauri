// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Symbologies resolved by the record-lookup flow. */
export const BARCODE_TYPES = ['qr', 'datamatrix', 'ean13', 'code128', 'upc_a', 'upc_e']

/** Repeated reads of the SAME value inside this window are ignored. */
export const DEBOUNCE_MS = 2000

/** Delay between the success flash starting and `onScanned` firing. */
export const SUCCESS_FIRE_MS = 220

/** Side of the square viewfinder cutout. */
export const RETICLE = 200

export const TABLET_BREAKPOINT = 768
export const TABLET_W = 360
export const TABLET_H = 440

// Spring curves mirroring the peek module's morph feel (0.42s / damping 0.8)
export const SPRING_IN = { damping: 18, stiffness: 240, mass: 0.9, useNativeDriver: true } as const
export const SPRING_OUT = { damping: 22, stiffness: 300, mass: 0.9, useNativeDriver: true } as const
