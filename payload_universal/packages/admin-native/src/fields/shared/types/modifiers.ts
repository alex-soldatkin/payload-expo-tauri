/**
 * Modifier config shapes shared across the native component registry.
 *
 * Modifier entries in the registry are FACTORY FUNCTIONS returning
 * `{ $type, ... }` configs. Always call them (`pickerStyle!('segmented')`) —
 * never pass object literals (missing $type = silently ignored).
 */

/** SwiftUI modifier config produced by @expo/ui modifier factories. */
export type NativeModifier = { $type: string; [key: string]: unknown }

/** Jetpack Compose modifier config produced by @expo/ui jetpack-compose helpers. */
export type JCModifier = { $type: string; $scope?: string; [key: string]: unknown }
