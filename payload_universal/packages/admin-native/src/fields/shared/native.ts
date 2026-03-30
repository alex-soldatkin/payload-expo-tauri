/**
 * Native component registry — default (web / unsupported platforms).
 *
 * Metro bundler resolves platform-specific files automatically:
 *   native.ios.ts     → loaded on iOS builds
 *   native.android.ts → loaded on Android builds
 *   native.ts         → fallback for all other platforms
 */
import { emptyRegistry } from './types'

export const nativeComponents = emptyRegistry
