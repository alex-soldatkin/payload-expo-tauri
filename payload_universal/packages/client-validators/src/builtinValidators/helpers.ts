/**
 * Shared pure helpers used across the built-in field validators.
 */
import type { ClientValidateOptions } from '../types'
import { t } from './messages'

// ---------------------------------------------------------------------------
// Array length validator (shared helper)
// ---------------------------------------------------------------------------

export function validateArrayLength(
  value: unknown,
  options: ClientValidateOptions,
): string | true {
  const { maxRows, minRows, required } = options
  const arrayLength = Array.isArray(value) ? value.length : 0

  if (!required && arrayLength === 0) return true

  if (typeof minRows === 'number' && arrayLength < minRows) {
    return t(options, 'validation:requiresAtLeast', { count: minRows, label: t(options, 'general:rows') })
  }

  if (typeof maxRows === 'number' && arrayLength > maxRows) {
    return t(options, 'validation:requiresNoMoreThan', { count: maxRows, label: t(options, 'general:rows') })
  }

  if (required && !arrayLength) {
    return t(options, 'validation:requiresAtLeast', { count: 1, label: t(options, 'general:row') })
  }

  return true
}

// ---------------------------------------------------------------------------
// Number coercion guard
// ---------------------------------------------------------------------------

export const isNumber = (val: unknown): val is number =>
  typeof val === 'number' ? !isNaN(val) : typeof val === 'string' ? val.trim() !== '' && !isNaN(Number(val)) : false
