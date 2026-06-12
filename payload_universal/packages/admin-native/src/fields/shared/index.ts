/**
 * Shared utilities for field components.
 *
 * - FieldShell:        Consistent label/description/error wrapper
 * - nativeComponents:  Platform-resolved @expo/ui component registry
 * - types:             Registry type definitions
 */
export { FieldShell, fieldShellStyles, NativeFormContext, useIsInsideNativeForm } from './FieldShell'
export { nativeComponents } from './native'
export type { JCModifier, NativeComponentRegistry, NativeModifier } from './types'
export { emptyRegistry } from './types'
