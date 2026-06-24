/**
 * DocumentForm – renders a complete form for a collection document or global
 * using the admin schema field definitions.
 *
 * Integrates react-hook-form (Phase 2) when available:
 *   - Zod-based client-side validation generated from Payload field schemas
 *   - Per-field re-render isolation via Controller
 *   - Dirty tracking, isDirty, dirtyFields
 *   - Server error injection into RHF error state
 *
 * Falls back to the original useState approach if RHF is not installed.
 *
 * Splits fields into main and sidebar sections (matching Payload's web admin).
 * On mobile, sidebar fields render in a "Details" section below the main fields.
 *
 * Exposes a ref with { submit() } so the parent can trigger save from a header button.
 *
 * Folder structure (purely structural split of the original DocumentForm.tsx):
 *   - segmentation.ts        — field carve-out / segmentation + validation parsing helpers
 *   - types.ts               — Props, DocumentFormHandle, FieldSegment
 *   - styles.ts              — StyleSheet factories
 *   - glass.ts               — optional native module requires (glass / blur / safe-area)
 *   - components/            — sub-components (variants, native body, bridges, panels)
 */
import React, { forwardRef, useMemo } from 'react'

import { extractRootFields } from '../utils/schemaHelpers'
import { isRHFAvailable } from '../hooks/usePayloadForm'
import type { DocumentFormHandle, Props } from './types'
import { useStableInitialData } from './segmentation'
import { DocumentFormRHF } from './components/DocumentFormRHF'
import { DocumentFormLegacy } from './components/DocumentFormLegacy'

// ===========================================================================
// Public DocumentForm — delegates to RHF or Legacy based on availability
// ===========================================================================

export const DocumentForm = forwardRef<DocumentFormHandle, Props>(({
  schemaMap,
  slug,
  initialData,
  ...rest
}, ref) => {
  const rootFields = useMemo(() => extractRootFields(schemaMap, slug), [schemaMap, slug])
  // Robustness against unstable parent identities (`doc ?? {}` per render):
  // a new-but-equal object can never re-trigger downstream state.
  const stableInitialData = useStableInitialData(initialData)

  if (isRHFAvailable) {
    return <DocumentFormRHF ref={ref} rootFields={rootFields} slug={slug} schemaMap={schemaMap} initialData={stableInitialData} {...rest} />
  }

  return <DocumentFormLegacy ref={ref} rootFields={rootFields} slug={slug} schemaMap={schemaMap} initialData={stableInitialData} {...rest} />
})

// ---------------------------------------------------------------------------
// Public re-exports — preserve every symbol the original DocumentForm.tsx
// exported so consumers (and the package barrel src/index.ts) keep working
// through the unchanged `./DocumentForm` import path.
// ---------------------------------------------------------------------------

// Segmentation helpers (kept exported)
export {
  FORM_CARVE_OUT_TYPES,
  canUseNativeFormForFields,
  segmentFieldsForForm,
  splitVisibleFieldsBySidebar,
} from './segmentation'

// FormData context re-exports (backwards compatibility)
export { FormDataContext, useFormData } from '../contexts/FormDataContext'
export type { FormDataContextValue } from '../contexts/FormDataContext'

// Public handle type
export type { DocumentFormHandle } from './types'
