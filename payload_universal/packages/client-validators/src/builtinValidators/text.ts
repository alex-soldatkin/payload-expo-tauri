/**
 * Text-family field validators: text, textarea, email, password.
 */
import type { ClientValidate } from '../types'
import { t } from './messages'
import { validateArrayLength } from './helpers'

export const text: ClientValidate<string | string[]> = (value, options) => {
  const { hasMany, maxLength, minLength, required } = options

  if (!required) {
    if (value === undefined || value === null) return true
  }

  if (hasMany) {
    const result = validateArrayLength(value, options)
    if (typeof result === 'string') return result
  }

  const stringsToValidate: string[] = Array.isArray(value) ? value : [value ?? '']

  for (const str of stringsToValidate) {
    const len = str?.length ?? 0

    if (typeof maxLength === 'number' && len > maxLength) {
      return t(options, 'validation:shorterThanMax', { maxLength, label: t(options, 'general:value') })
    }

    if (typeof minLength === 'number' && len < minLength) {
      return t(options, 'validation:longerThanMin', { minLength, label: t(options, 'general:value') })
    }
  }

  if (required) {
    if (!(typeof value === 'string' || Array.isArray(value)) || value?.length === 0) {
      return t(options, 'validation:required')
    }
  }

  return true
}

export const textarea: ClientValidate<string> = (value, options) => {
  const { maxLength, minLength, required } = options

  if (value && typeof maxLength === 'number' && value.length > maxLength) {
    return t(options, 'validation:shorterThanMax', { maxLength })
  }

  if (value && typeof minLength === 'number' && value.length < minLength) {
    return t(options, 'validation:longerThanMin', { minLength })
  }

  if (required && !value) {
    return t(options, 'validation:required')
  }

  return true
}

export const email: ClientValidate<string> = (value, options) => {
  const { required } = options

  // Same regex as Payload's server-side validator
  const emailRegex =
    /^(?!.*\.\.)[\w!#$%&'*+/=?^`{|}~-](?:[\w!#$%&'*+/=?^`{|}~.-]*[\w!#$%&'*+/=?^`{|}~-])?@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/i

  if ((value && !emailRegex.test(value)) || (!value && required)) {
    return t(options, 'validation:emailAddress')
  }

  return true
}

export const password: ClientValidate<string> = (value, options) => {
  const { maxLength, required } = options
  const minLength = options.minLength ?? 3

  if (value && typeof maxLength === 'number' && value.length > maxLength) {
    return t(options, 'validation:shorterThanMax', { maxLength })
  }

  if (value && minLength && value.length < minLength) {
    return t(options, 'validation:longerThanMin', { minLength })
  }

  if (required && !value) {
    return t(options, 'validation:required')
  }

  return true
}
