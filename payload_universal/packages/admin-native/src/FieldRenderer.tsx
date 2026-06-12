/**
 * FieldRenderer -- dispatches a ClientField to the correct native component
 * based on its `type` property. Hidden fields are skipped.
 *
 * Supports custom component overrides via CustomComponentContext:
 *   1. Check customComponentRegistry[collectionSlug.fieldPath] for an override
 *   2. Fall back to fieldRegistry[field.type]
 *   3. Fall back to FallbackField
 *
 * `ui` fields match the web admin behavior: a registered custom Field
 * component renders without FieldShell chrome; with nothing registered the
 * field renders nothing at all.
 *
 * Also renders beforeInput / afterInput injection slots when present.
 */
import React from 'react'

import type { ClientField, FieldValue } from './types'
import { isFieldHidden } from './utils/schemaHelpers'
import { getFieldComponent } from './fields'
import { useCustomComponent, useCustomFieldSlots } from './contexts/CustomComponentContext'
import { useFormData } from './contexts/FormDataContext'
import { NativeFormContext, useIsInsideNativeForm } from './fields/shared'
import { View } from 'react-native'

/** Field types that need a carve-out inside the native SwiftUI Form.
 *  They have their own scroll/layout (UITextView, FlatList) that conflicts
 *  with the Form's List-based layout. Matches DocumentForm's FORM_CARVE_OUT_TYPES. */
const FORM_CARVE_OUT_TYPES = new Set(['richText', 'join'])

type Props = {
  field: ClientField
  value: FieldValue
  onChange: (value: FieldValue) => void
  path: string
  disabled?: boolean
  error?: string
  /** Collection slug — enables per-collection custom component overrides. */
  collectionSlug?: string
}

export const FieldRenderer: React.FC<Props> = ({
  field,
  value,
  onChange,
  path,
  disabled,
  error,
  collectionSlug,
}) => {
  // ── Hooks first — unconditional, so hook order stays stable no matter
  //    what early return below fires (hidden / ui / regular). ──

  // When the caller doesn't pass collectionSlug (DocumentForm doesn't),
  // fall back to the surrounding form's slug so collection-scoped registry
  // keys ("posts.title") still resolve.
  const formCtx = useFormData()
  const slugForLookup = collectionSlug ?? formCtx?.slug

  // 1. Check for custom Field override
  const CustomComponent = useCustomComponent(slugForLookup, path, 'Field')

  // 2.5 Per-field carve-out: if inside a native Form and this field type is
  // incompatible (richText, join), override NativeFormContext to false so the
  // field renders in fallback mode. This handles deeply nested cases
  // (e.g. richText inside a group inside a tab) automatically.
  const insideNativeForm = useIsInsideNativeForm()

  // 3. Check for beforeInput / afterInput injection slots
  const { beforeInput, afterInput } = useCustomFieldSlots(slugForLookup, path)

  // Skip hidden fields
  if (isFieldHidden(field)) return null

  // `ui` fields (web parity): render the registered custom component without
  // FieldShell chrome; render nothing when no component is registered.
  if (field.type === 'ui') {
    if (!CustomComponent) return null
    const customUI = (
      <CustomComponent
        field={field}
        value={value}
        onChange={onChange}
        path={path}
        disabled={disabled}
        error={error}
      />
    )
    // Inside a native SwiftUI Form, avoid injecting a bare RN View as a
    // Form-section child — render the component directly.
    return insideNativeForm ? customUI : <View>{customUI}</View>
  }

  // 2. Fall back to standard field registry
  const Component = CustomComponent ?? getFieldComponent(field.type)

  const needsCarveOut = insideNativeForm && FORM_CARVE_OUT_TYPES.has(field.type)

  // If there are injection slots, wrap the component
  if (beforeInput.length > 0 || afterInput.length > 0) {
    return (
      <>
        {beforeInput.map((Before, i) => (
          <Before key={`before-${i}`} field={field} path={path} value={value} />
        ))}
        <Component
          field={field}
          value={value}
          onChange={onChange}
          path={path}
          disabled={disabled}
          error={error}
        />
        {afterInput.map((After, i) => (
          <After key={`after-${i}`} field={field} path={path} value={value} />
        ))}
      </>
    )
  }

  const rendered = (
    <Component
      field={field}
      value={value}
      onChange={onChange}
      path={path}
      disabled={disabled}
      error={error}
    />
  )

  // Wrap in carve-out context if needed — overrides NativeFormContext to false
  // so the field renders in fallback mode (plain RN Views, not Form cells).
  // This is a safety net for deeply nested incompatible fields; the primary
  // carve-out happens at the DocumentForm level via segmentFieldsForForm.
  if (needsCarveOut) {
    return (
      <NativeFormContext.Provider value={false}>
        {rendered}
      </NativeFormContext.Provider>
    )
  }

  return rendered
}
