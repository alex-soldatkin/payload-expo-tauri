/**
 * Collection / reference field validators: array, blocks, relationship, upload, richText.
 */
import type { ClientValidate } from '../types'
import { t } from './messages'
import { validateArrayLength } from './helpers'

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
