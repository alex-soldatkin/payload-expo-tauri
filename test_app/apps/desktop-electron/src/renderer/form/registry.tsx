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

// ---- Action components (codegen passthrough of listMenuItems / -------------
// admin.components.edit.editMenuItems). They take no props — they read the
// shim's selection / document scopes — and render as menu entries in the
// SelectionBar (list) and doc menus (edit).
export type ActionComponentKind = 'list' | 'edit'
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- actions take
// no meaningful props (they read shim scopes); any keeps JSX key/list usage sane.
const actionComponents: Record<string, ComponentType<any>[]> = {}

export function registerActionComponents(
  slug: string,
  kind: ActionComponentKind,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  components: ComponentType<any>[],
): void {
  actionComponents[`${slug}.${kind}`] = components
}

export function getActionComponents(
  slug: string,
  kind: ActionComponentKind,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): ComponentType<any>[] {
  return actionComponents[`${slug}.${kind}`] ?? []
}

export function registerFieldComponents(key: string, slots: FieldSlots): void {
  fieldSlots[key] = { ...fieldSlots[key], ...slots }
}

/** Scoped key first, then bare field path. */
export function getFieldSlots(slug: string, fieldPath: string): FieldSlots | undefined {
  return fieldSlots[`${slug}.${fieldPath}`] ?? fieldSlots[fieldPath]
}
