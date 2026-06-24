/**
 * Numeric / scalar field validators: number, checkbox, date.
 */
import type { ClientValidate } from '../types'
import { t } from './messages'
import { validateArrayLength, isNumber } from './helpers'

export const number: ClientValidate<number | number[]> = (value, options) => {
  const { hasMany, max, min, required } = options

  if (hasMany) {
    const result = validateArrayLength(value, options)
    if (typeof result === 'string') return result
  }

  if (!value && !isNumber(value)) {
    return required ? t(options, 'validation:required') : true
  }

  const numbersToValidate: number[] = Array.isArray(value) ? value : [value!]

  for (const num of numbersToValidate) {
    if (!isNumber(num)) {
      return t(options, 'validation:enterNumber')
    }

    const numValue = typeof num === 'string' ? parseFloat(num) : num

    if (typeof max === 'number' && numValue > max) {
      return t(options, 'validation:greaterThanMax', { max, label: t(options, 'general:value') })
    }

    if (typeof min === 'number' && numValue < min) {
      return t(options, 'validation:lessThanMin', { min, label: t(options, 'general:value') })
    }
  }

  return true
}

export const checkbox: ClientValidate<boolean> = (value, options) => {
  const { required } = options

  if ((value && typeof value !== 'boolean') || (required && typeof value !== 'boolean')) {
    return t(options, 'validation:trueOrFalse')
  }

  return true
}

export const date: ClientValidate<string | Date> = (value, options) => {
  const { required } = options

  const validDate = value && !isNaN(Date.parse(String(value)))

  if (validDate) return true

  if (value) {
    return t(options, 'validation:notValidDate', { value: String(value) })
  }

  if (required) {
    return t(options, 'validation:required')
  }

  return true
}
