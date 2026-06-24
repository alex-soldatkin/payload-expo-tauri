/**
 * DocumentForm — field segmentation + validation parsing helpers.
 *
 * Extracted from the original DocumentForm.tsx (purely structural; no behavior
 * change). The folder index re-exports the public symbols
 * (FORM_CARVE_OUT_TYPES, canUseNativeFormForFields, segmentFieldsForForm,
 * splitVisibleFieldsBySidebar).
 */
import { useRef } from 'react'
import type { ClientField, FormErrors } from '../types'
import { deepEqual } from '../utils/diff'
import { isFieldHidden, splitFieldsBySidebar } from '../utils/schemaHelpers'
import type { FieldSegment } from './types'

// ---------------------------------------------------------------------------
// Form field segmentation — split top-level fields into runs of compatible
// fields (grouped in a single Section) and individual incompatible fields
// (each gets its own carve-out Section).
// ---------------------------------------------------------------------------

/** Field types whose native views crash inside a SwiftUI Form cell.
 *  UITextView (richText) and FlatList (join) conflict with List self-sizing. */
export const FORM_CARVE_OUT_TYPES = new Set(['richText', 'join'])

/**
 * Recursively check whether a field (or any of its descendants) contains
 * an incompatible type that needs a carve-out. Structural fields (tabs,
 * group, collapsible, row, array, blocks) are checked through their children.
 */
const containsIncompatibleField = (field: ClientField): boolean => {
  if (FORM_CARVE_OUT_TYPES.has(field.type)) return true
  const f = field as any
  if (field.type === 'tabs') {
    return (f.tabs ?? []).some((tab: any) => (tab.fields ?? []).some(containsIncompatibleField))
  }
  if (field.type === 'group' || field.type === 'collapsible' || field.type === 'row') {
    return (f.fields ?? []).some(containsIncompatibleField)
  }
  if (field.type === 'array') {
    return (f.fields ?? []).some(containsIncompatibleField)
  }
  if (field.type === 'blocks') {
    return (f.blocks ?? []).some((block: any) => (block.fields ?? []).some(containsIncompatibleField))
  }
  return false
}

/**
 * Split a flat field array into segments for native Form rendering.
 * Consecutive compatible fields are grouped into one Section.
 * Fields that ARE or CONTAIN incompatible types get their own carve-out Section.
 */
export const segmentFieldsForForm = (fields: ClientField[]): FieldSegment[] => {
  const segments: FieldSegment[] = []
  let compatibleRun: ClientField[] = []

  const flushRun = () => {
    if (compatibleRun.length > 0) {
      segments.push({ type: 'compatible', fields: compatibleRun })
      compatibleRun = []
    }
  }

  for (const field of fields) {
    if (containsIncompatibleField(field)) {
      flushRun()
      segments.push({ type: 'carveout', field })
    } else {
      compatibleRun.push(field)
    }
  }
  flushRun()

  return segments
}

/**
 * Whether ALL of the given fields (and their descendants) can live inside a
 * single native SwiftUI Form. False as soon as any field needs a carve-out
 * (richText/join own their scroll/layout and crash inside Form cells).
 *
 * The native Form path only activates when this returns true: ONE
 * full-screen NativeHost > Form wrapping all Sections. Standalone Sections
 * (outside a Form/List) crash, and multiple Forms inside one ScrollView are
 * not supported — when carve-outs would be needed we keep the JS
 * FormSection path, which intentionally mimics grouped lists.
 */
export const canUseNativeFormForFields = (fields: ClientField[]): boolean =>
  fields.every((field) => !containsIncompatibleField(field))

/**
 * Split into main/sidebar AND drop admin.hidden fields BEFORE section
 * assembly. FieldRenderer also skips hidden fields, but only at render time
 * — by then FormSection has already wrapped each one in a 44pt row with
 * separators between them. Upload collections auto-add ~10 hidden fields
 * (url, thumbnailURL, filename, mimeType, filesize, width, height,
 * focalX/focalY, sizes), which is exactly what piled empty rows + dividers
 * around the Media collection's single visible `alt` field.
 */
export const splitVisibleFieldsBySidebar = (
  fields: ClientField[],
): { mainFields: ClientField[]; sidebarFields: ClientField[] } => {
  const { mainFields, sidebarFields } = splitFieldsBySidebar(fields)
  return {
    mainFields: mainFields.filter((f) => !isFieldHidden(f)),
    sidebarFields: sidebarFields.filter((f) => !isFieldHidden(f)),
  }
}

/**
 * Parse Payload REST API validation error response into a field error map.
 * Payload returns: { errors: [{ data: { errors: [{ path, message }] }, message }] }
 */
export const parseValidationErrors = (err: unknown): { fieldErrors: FormErrors; summary: string | null } => {
  const fieldErrors: FormErrors = {}
  let summary: string | null = null

  if (err && typeof err === 'object' && 'errors' in err) {
    const topErrors = (err as { errors: Array<{ message?: string; data?: { errors?: Array<{ path: string; message: string }> } }> }).errors
    for (const topErr of topErrors) {
      summary = topErr.message ?? summary
      if (topErr.data?.errors) {
        for (const fieldErr of topErr.data.errors) {
          if (fieldErr.path) {
            fieldErrors[fieldErr.path] = fieldErr.message
          }
        }
      }
    }
  }

  return { fieldErrors, summary }
}

/**
 * Minimum content width (px) at which the Notes/Freeform-style sidebar edge
 * tab is rendered. Phones keep the header toolbar button, where a persistent
 * edge tab would crowd the content.
 */
export const EDGE_TAB_MIN_WIDTH = 768

/**
 * Latch `initialData` to a referentially-stable object.
 *
 * Screens commonly pass `initialData={doc ?? {}}` (or a fresh RxDB
 * `toJSON()` clone) — a NEW object identity on every parent render even
 * when the contents are identical. `useForm` only captures `defaultValues`
 * at mount, but react-hook-form keeps the live props on `control._options`
 * every render, so an unstable identity leaks into every dirty-check /
 * reset consumer and can re-trigger state from anything keyed on it
 * (Maximum update depth exceeded, details sheet 2026-06-11). The latch
 * returns the SAME reference for new-but-deep-equal objects, so identity
 * churn upstream becomes a no-op; genuinely different data still flows
 * through (a single identity change, then stable again).
 */
export const useStableInitialData = (
  initialData: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined => {
  const ref = useRef(initialData)
  if (ref.current !== initialData && !deepEqual(ref.current, initialData)) {
    ref.current = initialData
  }
  return ref.current
}
