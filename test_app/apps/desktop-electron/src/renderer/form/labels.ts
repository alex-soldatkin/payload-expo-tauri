// Label/description resolution: Payload serializes these as plain strings or
// per-locale records. Prefer 'en', fall back to the first value.
import type { LabelValue, SchemaField } from './types'

export function resolveLabel(value: LabelValue, fallback = ''): string {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object') {
    return value.en ?? Object.values(value)[0] ?? fallback
  }
  return fallback
}

/** Title-case a field name as a last-resort label ('metaTitle' → 'Meta Title'). */
export function labelForField(field: SchemaField): string {
  const explicit = resolveLabel(field.label)
  if (explicit) return explicit
  const name = field.name ?? ''
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_]/g, ' ')
    .replace(/^./, (c) => c.toUpperCase())
}

export function resolveOptionLabel(opt: string | { label: LabelValue; value: string }): string {
  if (typeof opt === 'string') return opt
  return resolveLabel(opt.label, opt.value)
}

export function optionValue(opt: string | { label: LabelValue; value: string }): string {
  return typeof opt === 'string' ? opt : opt.value
}
