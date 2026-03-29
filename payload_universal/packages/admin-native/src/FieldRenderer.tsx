/**
 * FieldRenderer – dispatches a ClientField to the correct native component
 * based on its `type` property. Hidden and UI fields are skipped.
 */
import React from 'react'

import type { ClientField, FieldValue } from './types'
import { isFieldHidden } from './schemaHelpers'
import { getFieldComponent } from './fields'

type Props = {
  field: ClientField
  value: FieldValue
  onChange: (value: FieldValue) => void
  path: string
  disabled?: boolean
  error?: string
}

export const FieldRenderer: React.FC<Props> = ({
  field,
  value,
  onChange,
  path,
  disabled,
  error,
}) => {
  // Skip hidden and pure-UI fields
  if (isFieldHidden(field)) return null
  if (field.type === 'ui') return null

  const Component = getFieldComponent(field.type)

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
