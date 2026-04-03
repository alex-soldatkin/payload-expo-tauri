/**
 * Client-safe built-in field validators.
 *
 * Ported from payload-main/packages/payload/src/fields/validations.ts
 * with all server dependencies (req, t, payload, config) removed.
 *
 * Uses hardcoded English messages with an optional t() override for i18n.
 */
import type { ClientValidate, ClientValidateOptions, ClientTranslate } from './types'

// ---------------------------------------------------------------------------
// Default translate — returns English messages matching Payload's keys
// ---------------------------------------------------------------------------

const defaultT: ClientTranslate = (key, vars) => {
  const messages: Record<string, string> = {
    'validation:required': 'This field is required.',
    'validation:shorterThanMax': `Value must be no longer than ${vars?.maxLength ?? '?'} characters.`,
    'validation:longerThanMin': `Value must be at least ${vars?.minLength ?? '?'} characters.`,
    'validation:greaterThanMax': `Value must be no greater than ${vars?.max ?? '?'}.`,
    'validation:lessThanMin': `Value must be no less than ${vars?.min ?? '?'}.`,
    'validation:enterNumber': 'Please enter a valid number.',
    'validation:emailAddress': 'Please enter a valid email address.',
    'validation:trueOrFalse': 'This field can only be true or false.',
    'validation:invalidSelection': 'This field has an invalid selection.',
    'validation:invalidSelections': 'This field has the following invalid selections:',
    'validation:requiresAtLeast': `Requires at least ${vars?.count ?? '?'} ${vars?.label ?? 'item(s)'}.`,
    'validation:requiresNoMoreThan': `Requires no more than ${vars?.count ?? '?'} ${vars?.label ?? 'item(s)'}.`,
    'validation:requiresTwoNumbers': 'This field requires two valid numbers (longitude, latitude).',
    'validation:invalidInput': 'This field has an invalid input.',
    'validation:notValidDate': `"${vars?.value ?? ''}" is not a valid date.`,
    'validation:longitudeOutOfBounds': 'Longitude must be between -180 and 180.',
    'validation:latitudeOutOfBounds': 'Latitude must be between -90 and 90.',
    'fields:passwordsDoNotMatch': 'Passwords do not match.',
    'general:value': 'Value',
    'general:rows': 'rows',
    'general:row': 'row',
  }
  return messages[key] ?? key
}

function t(options: ClientValidateOptions, key: string, vars?: Record<string, unknown>): string {
  return (options.t ?? defaultT)(key, vars)
}

// ---------------------------------------------------------------------------
// Array length validator (shared helper)
// ---------------------------------------------------------------------------

function validateArrayLength(
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
// Field validators
// ---------------------------------------------------------------------------

const isNumber = (val: unknown): val is number =>
  typeof val === 'number' ? !isNaN(val) : typeof val === 'string' ? val.trim() !== '' && !isNaN(Number(val)) : false

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

export const array: ClientValidate<unknown[]> = (value, options) => {
  return validateArrayLength(value, options)
}

export const blocks: ClientValidate<unknown[]> = (value, options) => {
  return validateArrayLength(value, options)
}

export const relationship: ClientValidate<unknown> = (value, options) => {
  const { required } = options

  if (
    ((!value && typeof value !== 'number') ||
      (Array.isArray(value) && value.length === 0)) &&
    required
  ) {
    return t(options, 'validation:required')
  }

  // Array length constraints
  if (Array.isArray(value) && value.length > 0) {
    const { minRows, maxRows } = options
    if (typeof minRows === 'number' && value.length < minRows) {
      return t(options, 'validation:requiresAtLeast', { count: minRows, label: t(options, 'general:rows') })
    }
    if (typeof maxRows === 'number' && value.length > maxRows) {
      return t(options, 'validation:requiresNoMoreThan', { count: maxRows, label: t(options, 'general:rows') })
    }
  }

  // filterOptions validation skipped — requires DB queries, stays server-side
  return true
}

export const upload: ClientValidate<unknown> = (value, options) => {
  const { required } = options

  if (
    ((!value && typeof value !== 'number') ||
      (Array.isArray(value) && value.length === 0)) &&
    required
  ) {
    return t(options, 'validation:required')
  }

  return true
}

export const richText: ClientValidate<unknown> = (value, options) => {
  const { required } = options

  if (!required) return true

  // Rich text is usually a Lexical JSON object. Check for empty content.
  if (!value) return t(options, 'validation:required')

  if (typeof value === 'object' && value !== null) {
    const root = (value as Record<string, unknown>).root as Record<string, unknown> | undefined
    if (root) {
      const children = root.children as unknown[] | undefined
      if (!children || children.length === 0) {
        return t(options, 'validation:required')
      }
      // Single empty paragraph check
      if (
        children.length === 1 &&
        typeof children[0] === 'object' &&
        children[0] !== null
      ) {
        const firstChild = children[0] as Record<string, unknown>
        const innerChildren = firstChild.children as unknown[] | undefined
        if (
          firstChild.type === 'paragraph' &&
          (!innerChildren || innerChildren.length === 0 ||
            (innerChildren.length === 1 &&
              typeof innerChildren[0] === 'object' &&
              innerChildren[0] !== null &&
              (innerChildren[0] as Record<string, unknown>).text === ''))
        ) {
          return t(options, 'validation:required')
        }
      }
    }
  }

  return true
}

// ---------------------------------------------------------------------------
// Registry mapping field type → built-in validator
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const builtinValidators: Record<string, ClientValidate<any>> = {
  text,
  email,
  password,
  textarea,
  number,
  checkbox,
  date,
  code,
  json,
  select,
  radio,
  point,
  array,
  blocks,
  relationship,
  upload,
  richText,
}
