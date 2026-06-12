/**
 * Shared utilities for field components.
 *
 * - FieldShell:        Consistent label/description/error wrapper
 * - nativeComponents:  Platform-resolved @expo/ui component registry
 * - types:             Registry type definitions
 */
export { FieldShell, fieldShellStyles, NativeFormContext, useIsInsideNativeForm } from './FieldShell'
// Canonical row metrics (single source: theme) — field components conform to
// these instead of inventing their own insets/heights.
export { CONTENT_INSET, INLINE_ROW_GAP, ROW_MIN_HEIGHT, STACKED_LABEL_GAP } from '../../theme'
export { nativeComponents } from './native'
export type { JCModifier, NativeComponentRegistry, NativeModifier } from './types'
export { emptyRegistry } from './types'
