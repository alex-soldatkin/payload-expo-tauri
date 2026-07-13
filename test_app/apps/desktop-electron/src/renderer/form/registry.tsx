// Custom component registry — the DOM counterpart of admin-native's
// CustomComponentContext. Keys follow the same convention:
//   `${slug}.${fieldPath}` (collection-scoped) or bare `fieldPath`.
// Slots mirror Payload's admin.components: Field replaces the whole editor,
// beforeInput/afterInput decorate it, RowLabel labels array rows.
//
// DOM ports of the SSOT components (SlugField, SEOPreview, …) register here
// (issue #16); until then every field falls back to its type-based editor.
import type { ComponentType } from 'react'
import type { FieldComponentProps } from './types'

export type RowLabelProps = { data: Record<string, unknown>; index: number }

export type FieldSlots = {
  Field?: ComponentType<FieldComponentProps>
  beforeInput?: ComponentType<FieldComponentProps>
  afterInput?: ComponentType<FieldComponentProps>
  RowLabel?: ComponentType<RowLabelProps>
}

const fieldSlots: Record<string, FieldSlots> = {}

export function registerFieldComponents(key: string, slots: FieldSlots): void {
  fieldSlots[key] = { ...fieldSlots[key], ...slots }
}

/** Scoped key first, then bare field path. */
export function getFieldSlots(slug: string, fieldPath: string): FieldSlots | undefined {
  return fieldSlots[`${slug}.${fieldPath}`] ?? fieldSlots[fieldPath]
}
