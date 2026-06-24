/**
 * RHFFieldBridge — Phase 2 Controller bridge (Phase 3 ready).
 *
 * Extracted from the original DocumentForm.tsx (purely structural; no behavior
 * change).
 *
 * Bridge between RHF's Controller and our existing FieldRenderer.
 * Each field gets its own Controller — re-renders are isolated to the
 * changed field only (not the entire form tree).
 *
 * Phase 3: Field components that call `usePayloadField` directly will
 * bypass this bridge and get even more direct RHF integration.
 */
import React from 'react'

import type { ClientField } from '../../types'
import { FieldRenderer } from '../../FieldRenderer'

let _Controller: React.ComponentType<any> | null = null
try {
  _Controller = require('react-hook-form').Controller
} catch { /* not available */ }

export const RHFFieldBridge: React.FC<{
  control: any
  name: string
  field: ClientField
  disabled?: boolean
  externalError?: string
  onEdit?: () => void
}> = ({ control, name, field, disabled, externalError, onEdit }) => {
  if (!_Controller) return null
  const Controller = _Controller

  return (
    <Controller
      control={control}
      name={name}
      render={({ field: rhfField, fieldState }: any) => (
        <FieldRenderer
          field={field}
          value={rhfField.value}
          onChange={(v: unknown) => {
            rhfField.onChange(v)
            onEdit?.()
          }}
          path={name}
          disabled={disabled}
          error={fieldState.error?.message || externalError}
        />
      )}
    />
  )
}
