/**
 * Shared utilities for field components.
 *
 * - FieldShell:        Consistent label/description/error wrapper
 * - nativeComponents:  Platform-resolved @expo/ui component registry
 * - types:             Registry type definitions
 */
export { FieldShell, fieldShellStyles } from './FieldShell'
export { nativeComponents } from './native'
export type { NativeComponentRegistry } from './types'
export { emptyRegistry } from './types'
