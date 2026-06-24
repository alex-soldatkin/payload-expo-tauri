/**
 * Pure helpers shared across the TextInput-based field components.
 */
import type { ClientTextField } from '../../types'

/** Password-ish text fields render as SecureField on iOS / secureTextEntry in JS. */
export const isPasswordLike = (field: ClientTextField): boolean =>
  (field.admin as { autoComplete?: string } | undefined)?.autoComplete === 'password' ||
  field.name === 'password'

/** Slug/identifier-ish fields get autocorrection turned off. */
export const isSlugLike = (field: { name?: string; unique?: boolean }): boolean =>
  Boolean(field.unique) || /(slug|url|uri|key|token|handle|username)/i.test(field.name ?? '')

export const clampNumber = (n: number, min?: number, max?: number): number => {
  let v = n
  if (min != null && v < min) v = min
  if (max != null && v > max) v = max
  return v
}
