import React, { createContext, useContext, useMemo } from 'react'

import type { ClientField, FormErrors } from '../../../types'

// ---------------------------------------------------------------------------
// Context for recursive field rendering
// ---------------------------------------------------------------------------

export type RenderFieldFn = (field: ClientField, basePath: string) => React.ReactNode

export const FieldRendererContext = createContext<RenderFieldFn | null>(null)

export const useRenderField = (): RenderFieldFn => {
  const fn = useContext(FieldRendererContext)
  if (!fn) throw new Error('FieldRendererContext is required for structural fields')
  return fn
}

// ---------------------------------------------------------------------------
// Tab depth context — top-level tabs = segmented, nested = pills
// ---------------------------------------------------------------------------

export const TabDepthContext = createContext(0)
export const useTabDepth = () => useContext(TabDepthContext)

// ---------------------------------------------------------------------------
// RowLabel context — provided by ArrayField around custom RowLabel components
// (codegen registry slot 'RowLabel'). The @payload-universal/ui native shim's
// `useRowLabel()` should read this context; components also receive
// { data, rowNumber, index, path } as props for prop-based consumption.
// ---------------------------------------------------------------------------

export type RowLabelContextValue = {
  data: Record<string, unknown>
  /** 1-based row number (Payload web parity). */
  rowNumber: number
  /** 0-based row index. */
  index: number
  /** Full dot-path to the row, e.g. 'gallery.2'. */
  path: string
}

export const RowLabelContext = createContext<RowLabelContextValue | null>(null)

/** Read the enclosing array row's data/number (for custom RowLabel components). */
export const useRowLabelContext = (): RowLabelContextValue | null => useContext(RowLabelContext)

// ---------------------------------------------------------------------------
// Error map context
// ---------------------------------------------------------------------------

export const ErrorMapContext = createContext<FormErrors>({})

/** Count errors at or below a path prefix (non-hook — usable in loops). */
export const countErrorsForPrefix = (errors: FormErrors, prefix: string): number => {
  let count = 0
  for (const path in errors) {
    if (errors[path] && (path === prefix || path.startsWith(prefix + '.'))) count++
  }
  return count
}

export const useErrorCountForFields = (fields: ClientField[], basePath: string): number => {
  const errors = useContext(ErrorMapContext)
  return useMemo(() => {
    let count = 0
    for (const field of fields) {
      const fieldPath = field.name ? (basePath ? `${basePath}.${field.name}` : field.name) : basePath
      count += countErrorsForPrefix(errors, fieldPath)
    }
    return count
  }, [errors, fields, basePath])
}
