/**
 * Structured / option-based field validators: code, json, select, radio, point.
 */
import type { ClientValidate } from '../types'
import { t } from './messages'

export const code: ClientValidate<string> = (value, options) => {
  if (options.required && value === undefined) {
    return t(options, 'validation:required')
  }
  return true
}

export const json: ClientValidate<unknown> = (value, options) => {
  if (options.required && !value) {
    return t(options, 'validation:required')
  }

  // If value is a string, try to parse it
  if (typeof value === 'string') {
    try {
      JSON.parse(value)
    } catch {
      return t(options, 'validation:invalidInput')
    }
  }

  return true
}

export const select: ClientValidate<string | string[]> = (value, options) => {
  const { hasMany, required } = options
  const fieldOptions = options.options ?? []

  // Check that selected values match available options
  if (Array.isArray(value)) {
    const invalid = value.some(
      (input) =>
        !fieldOptions.some(
          (opt) => opt === input || (typeof opt !== 'string' && opt?.value === input),
        ),
    )
    if (invalid) {
      return t(options, 'validation:invalidSelection')
    }

    // Check for duplicates
    if (hasMany && value.length > 1) {
      const seen = new Set<string>()
      for (const item of value) {
        if (seen.has(item)) {
          return t(options, 'validation:invalidSelections')
        }
        seen.add(item)
      }
    }
  }

  if (typeof value === 'string') {
    const matchesOption = fieldOptions.some(
      (opt) => opt === value || (typeof opt !== 'string' && opt.value === value),
    )
    if (!matchesOption) {
      return t(options, 'validation:invalidSelection')
    }
  }

  if (
    required &&
    (typeof value === 'undefined' ||
      value === null ||
      (hasMany && Array.isArray(value) && value.length === 0))
  ) {
    return t(options, 'validation:required')
  }

  return true
}

export const radio: ClientValidate<string> = (value, options) => {
  const { required } = options
  const fieldOptions = options.options ?? []

  if (value) {
    const matchesOption = fieldOptions.some(
      (opt) => opt === value || (typeof opt !== 'string' && opt.value === value),
    )
    return matchesOption || t(options, 'validation:invalidSelection')
  }

  return required ? t(options, 'validation:required') : true
}

export const point: ClientValidate<[number | string, number | string]> = (
  value = ['', ''],
  options,
) => {
  const { required } = options

  if (value === null) {
    return required ? t(options, 'validation:required') : true
  }

  const lng = parseFloat(String(value[0]))
  const lat = parseFloat(String(value[1]))

  if (
    required &&
    ((value[0] && value[1] && typeof lng !== 'number' && typeof lat !== 'number') ||
      Number.isNaN(lng) ||
      Number.isNaN(lat) ||
      (Array.isArray(value) && value.length !== 2))
  ) {
    return t(options, 'validation:requiresTwoNumbers')
  }

  if ((value[1] && Number.isNaN(lng)) || (value[0] && Number.isNaN(lat))) {
    return t(options, 'validation:invalidInput')
  }

  if (value[0] && !Number.isNaN(lng) && (lng < -180 || lng > 180)) {
    return t(options, 'validation:longitudeOutOfBounds')
  }

  if (value[1] && !Number.isNaN(lat) && (lat < -90 || lat > 90)) {
    return t(options, 'validation:latitudeOutOfBounds')
  }

  return true
}
