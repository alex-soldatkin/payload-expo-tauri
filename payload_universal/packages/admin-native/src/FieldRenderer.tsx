/**
 * FieldRenderer -- dispatches a ClientField to the correct native component
 * based on its `type` property. Hidden and UI fields are skipped.
 *
 * Supports custom component overrides via CustomComponentContext:
 *   1. Check customComponentRegistry[collectionSlug.fieldPath] for an override
 *   2. Fall back to fieldRegistry[field.type]
 *   3. Fall back to FallbackField
 *
 * Also renders beforeInput / afterInput injection slots when present.
 */
import React from 'react'

import type { ClientField, FieldValue } from './types'
import { isFieldHidden } from './utils/schemaHelpers'
import { getFieldComponent } from './fields'
import { useCustomComponent, useCustomFieldSlots } from './contexts/CustomComponentContext'

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
  // Skip hidden and pure-UI fields
  if (isFieldHidden(field)) return null
  if (field.type === 'ui') return null

  // 1. Check for custom Field override
  const CustomComponent = useCustomComponent(collectionSlug, path, 'Field')

  // 2. Fall back to standard field registry
  const Component = CustomComponent ?? getFieldComponent(field.type)

  // 3. Check for beforeInput / afterInput injection slots
  const { beforeInput, afterInput } = useCustomFieldSlots(collectionSlug, path)

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

  return (
    <Component
      field={field}
      value={value}
      onChange={onChange}
      path={path}
      disabled={disabled}
      error={error}
    />
  )
}
