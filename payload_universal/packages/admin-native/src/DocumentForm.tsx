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
 */
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { Animated, ScrollView, StyleSheet, Text, View } from 'react-native'

// Optional: GlassView for liquid glass containers on iOS 26+
let GlassView: React.ComponentType<any> | null = null
let liquidGlassAvailable = false
try {
  const glassModule = require('expo-glass-effect')
  GlassView = glassModule.GlassView
  liquidGlassAvailable = glassModule.isLiquidGlassAvailable?.() ?? false
} catch {
  /* not available */
}

import type { ClientField, FormErrors, SerializedSchemaMap } from './types'
import { defaultTheme as t } from './theme'
import { extractRootFields, getByPath, groupFieldsByWidth, setByPath, splitFieldsBySidebar } from './utils/schemaHelpers'
import { ErrorMapContext, FieldRendererContext } from './fields/structural'
import { FieldRenderer } from './FieldRenderer'
import { useToast } from './Toast'
import { PayloadAPIError } from './utils/api'
import { FormDataContext } from './contexts/FormDataContext'
import { validateFormData } from './utils/validation'
import {
  FormProvider,
  isRHFAvailable,
  usePayloadForm,
} from './hooks/usePayloadForm'

// Re-export for backwards compatibility
export { FormDataContext, useFormData } from './contexts/FormDataContext'
export type { FormDataContextValue } from './contexts/FormDataContext'

export type DocumentFormHandle = {
  submit: () => void
  /** Submit with explicit _status override (for draft/publish flows). */
  submitWithStatus: (status: 'draft' | 'published') => void
  /** Get current form data without submitting. */
  getFormData: () => Record<string, unknown>
  /** Whether the form has unsaved changes. */
  isDirty?: boolean
}

type Props = {
  /** Serialized field schema map (from AdminSchema.collections[slug] or globals[slug]) */
  schemaMap: SerializedSchemaMap<unknown>
  /** The collection or global slug */
  slug: string
  /** Initial document data (empty object for create) */
  initialData?: Record<string, unknown>
  /** Called when the user taps Save. Receives optional status for draft/publish. */
  onSubmit: (data: Record<string, unknown>, options?: { status?: 'draft' | 'published' }) => Promise<void>
  /** Called when the user taps Delete (rendered at bottom of form) */
  onDelete?: () => void
  /** External validation errors (e.g. from the API) */
  errors?: FormErrors
  /** Disable all fields */
  disabled?: boolean
  /** Label for the submit button */
  submitLabel?: string
  /** Extra top padding (e.g. for transparent headers) */
  contentInsetTop?: number
  /** Current draft/publish status. When set, renders dual Save Draft / Publish buttons. */
  draftStatus?: 'draft' | 'published'
  /** Scroll event handler forwarded to the inner ScrollView (e.g. for scroll-driven header blur). */
  onScroll?: (event: any) => void
  /** Scroll event throttle in ms (default 16). Only used when onScroll is provided. */
  scrollEventThrottle?: number
}

/**
 * Parse Payload REST API validation error response into a field error map.
 * Payload returns: { errors: [{ data: { errors: [{ path, message }] }, message }] }
 */
const parseValidationErrors = (err: unknown): { fieldErrors: FormErrors; summary: string | null } => {
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

// ===========================================================================
// RHF-powered DocumentForm (Phase 2 + 3)
// ===========================================================================

const DocumentFormRHF = forwardRef<DocumentFormHandle, Props & { rootFields: ClientField[] }>(({
  rootFields,
  slug,
  initialData = {},
  onSubmit,
  onDelete,
  errors: externalErrors,
  disabled,
  submitLabel = 'Save',
  contentInsetTop = 0,
  draftStatus,
  onScroll,
  scrollEventThrottle = 16,
}, ref) => {
  const scrollViewRef = useRef<ScrollView>(null)
  const [scrollToError, setScrollToError] = useState(0)
  const [saveError, setSaveError] = useState<string | null>(null)
  const toast = useToast()

  const { mainFields, sidebarFields } = useMemo(
    () => splitFieldsBySidebar(rootFields),
    [rootFields],
  )

  // Initialize RHF with Zod resolver from the Payload field schema
  const payloadForm = usePayloadForm({
    fields: rootFields,
    defaultValues: initialData,
    onSubmit,
  })

  // This component is only rendered when RHF is available
  if (!payloadForm.isRHF) return null
  const { control, methods, submit, getFormData, isDirty, isSubmitting, serverErrors, setServerErrors, clearServerError } = payloadForm

  const { watch, formState: { errors: rhfErrors } } = methods

  // Watch all values for formData context and merged errors
  const formData = watch()

  // Merge RHF validation errors + external errors + server errors into flat map
  const mergedErrors = useMemo(() => {
    const merged: FormErrors = { ...externalErrors, ...serverErrors }
    // Flatten RHF's nested error object
    const flattenErrors = (errs: any, prefix = '') => {
      for (const key in errs) {
        const path = prefix ? `${prefix}.${key}` : key
        if (errs[key]?.message) {
          merged[path] = errs[key].message
        } else if (typeof errs[key] === 'object' && errs[key] !== null) {
          flattenErrors(errs[key], path)
        }
      }
    }
    flattenErrors(rhfErrors)
    return merged
  }, [externalErrors, serverErrors, rhfErrors])

  const errorCount = Object.keys(mergedErrors).filter((k) => mergedErrors[k]).length

  // Phase 2: Controller-based renderField — each field gets its own Controller
  // so only the edited field re-renders, not the entire form tree.
  const renderField = useCallback(
    (field: ClientField, basePath: string): React.ReactNode => {
      return (
        <RHFFieldBridge
          key={basePath}
          control={control}
          name={basePath}
          field={field}
          disabled={disabled || isSubmitting}
          externalError={mergedErrors[basePath]}
          onEdit={() => clearServerError(basePath)}
        />
      )
    },
    [control, disabled, isSubmitting, mergedErrors, clearServerError],
  )

  // Submit handler with server error handling
  const handleSubmit = async (statusOverride?: 'draft' | 'published') => {
    setSaveError(null)
    setServerErrors({})
    try {
      await submit(statusOverride)
      const label = statusOverride === 'draft' ? 'Draft saved' : statusOverride === 'published' ? 'Published' : 'Saved successfully'
      const icon = statusOverride === 'published' ? 'publish' as const : 'save' as const
      toast.showToast(label, { type: 'success', icon })
    } catch (err) {
      const body = err instanceof PayloadAPIError ? err.body : null
      const parsed = body ? parseValidationErrors(body) : { fieldErrors: {}, summary: null }

      if (Object.keys(parsed.fieldErrors).length > 0) {
        setServerErrors(parsed.fieldErrors)
        const count = Object.keys(parsed.fieldErrors).length
        const summary = parsed.summary || `${count} field${count !== 1 ? 's' : ''} failed validation`
        setSaveError(summary)
        toast.showToast(summary, { type: 'error', duration: 5000 })
        setScrollToError((n) => n + 1)
      } else {
        const msg = err instanceof Error ? err.message : 'Failed to save'
        setSaveError(msg)
        toast.showToast(msg, { type: 'error', duration: 4000 })
      }
    }
  }

  useImperativeHandle(ref, () => ({
    submit: () => handleSubmit(),
    submitWithStatus: (status: 'draft' | 'published') => handleSubmit(status),
    getFormData,
    isDirty,
  }), [handleSubmit, getFormData, isDirty])

  useEffect(() => {
    if (scrollToError === 0) return
    const timer = setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: 0, animated: true })
    }, 100)
    return () => clearTimeout(timer)
  }, [scrollToError])

  const renderFields = (fields: ClientField[]) => {
    const groups = groupFieldsByWidth(fields)
    return groups.map((group, gi) => {
      if (group.type === 'width-row') {
        return (
          <View key={`wrow-${gi}`} style={styles.widthRow}>
            {group.fields.map((f) => {
              const path = f.name ?? `wf-${gi}`
              return (
                <View key={path} style={{ flex: parseFloat(f.admin!.width!) / 100 }}>
                  {renderField(f, path)}
                </View>
              )
            })}
          </View>
        )
      }
      const path = group.field.name ?? `field-${gi}`
      return <React.Fragment key={path}>{renderField(group.field, path)}</React.Fragment>
    })
  }

  const formDataCtx = useMemo<FormDataContextValue>(
    () => ({ formData, slug }),
    [formData, slug],
  )

  const formContent = (
    <FormDataContext.Provider value={formDataCtx}>
    <ErrorMapContext.Provider value={mergedErrors}>
    <FieldRendererContext.Provider value={renderField}>
      <Animated.ScrollView
        ref={scrollViewRef as any}
        style={styles.scroll}
        contentContainerStyle={[styles.content, contentInsetTop > 0 && { paddingTop: contentInsetTop + t.spacing.lg }]}
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic"
        onScroll={onScroll}
        scrollEventThrottle={onScroll ? scrollEventThrottle : undefined}
      >
        {draftStatus && (
          <View style={styles.statusRow}>
            <View style={[styles.statusPill, draftStatus === 'draft' ? styles.statusDraft : styles.statusPublished]}>
              <Text style={[styles.statusPillText, draftStatus === 'draft' ? styles.statusDraftText : styles.statusPublishedText]}>
                {draftStatus === 'draft' ? 'Draft' : 'Published'}
              </Text>
            </View>
          </View>
        )}

        {errorCount > 0 && (
          <View style={styles.validationBanner}>
            <Text style={styles.validationIcon}>!</Text>
            <Text style={styles.validationText}>
              {errorCount} field{errorCount !== 1 ? 's' : ''} {errorCount !== 1 ? 'have' : 'has'} errors. Please correct them below.
            </Text>
          </View>
        )}

        {renderFields(mainFields)}

        {sidebarFields.length > 0 && (
          liquidGlassAvailable && GlassView ? (
            <GlassView style={styles.glassSidebarSection} glassEffectStyle="regular">
              <View style={styles.sidebarHeader}><Text style={styles.sidebarTitle}>Details</Text></View>
              <View style={styles.sidebarBody}>{renderFields(sidebarFields)}</View>
            </GlassView>
          ) : (
            <View style={styles.sidebarSection}>
              <View style={styles.sidebarHeader}><Text style={styles.sidebarTitle}>Details</Text></View>
              <View style={styles.sidebarBody}>{renderFields(sidebarFields)}</View>
            </View>
          )
        )}

        {saveError && !errorCount && (
          <View style={styles.errorBanner}><Text style={styles.errorText}>{saveError}</Text></View>
        )}
      </Animated.ScrollView>
    </FieldRendererContext.Provider>
    </ErrorMapContext.Provider>
    </FormDataContext.Provider>
  )

  // Wrap in FormProvider so nested components can use useFormContext / usePayloadField
  return FormProvider ? (
    <FormProvider {...methods}>{formContent}</FormProvider>
  ) : formContent
})

// ---------------------------------------------------------------------------
// RHFFieldBridge — Phase 2 Controller bridge (Phase 3 ready)
// ---------------------------------------------------------------------------

/**
 * Bridge between RHF's Controller and our existing FieldRenderer.
 * Each field gets its own Controller — re-renders are isolated to the
 * changed field only (not the entire form tree).
 *
 * Phase 3: Field components that call `usePayloadField` directly will
 * bypass this bridge and get even more direct RHF integration.
 */
let _Controller: React.ComponentType<any> | null = null
try {
  _Controller = require('react-hook-form').Controller
} catch { /* not available */ }

const RHFFieldBridge: React.FC<{
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

// ===========================================================================
// Legacy useState-based DocumentForm (fallback when RHF not available)
// ===========================================================================

const DocumentFormLegacy = forwardRef<DocumentFormHandle, Props & { rootFields: ClientField[] }>(({
  rootFields,
  slug,
  initialData = {},
  onSubmit,
  onDelete,
  errors: externalErrors,
  disabled,
  submitLabel = 'Save',
  contentInsetTop = 0,
  draftStatus,
  onScroll,
  scrollEventThrottle = 16,
}, ref) => {
  const [formData, setFormData] = useState<Record<string, unknown>>(initialData)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [serverErrors, setServerErrors] = useState<FormErrors>({})
  const [clientErrors, setClientErrors] = useState<FormErrors>({})
  const [scrollToError, setScrollToError] = useState(0)
  const scrollViewRef = useRef<ScrollView>(null)
  const toast = useToast()

  const { mainFields, sidebarFields } = useMemo(
    () => splitFieldsBySidebar(rootFields),
    [rootFields],
  )

  // Merge external + server + client validation errors
  const mergedErrors = useMemo(() => ({
    ...externalErrors,
    ...clientErrors,
    ...serverErrors,
  }), [externalErrors, clientErrors, serverErrors])

  const errorCount = Object.keys(mergedErrors).filter((k) => mergedErrors[k]).length

  const renderField = useCallback(
    (field: ClientField, basePath: string): React.ReactNode => {
      const value = getByPath(formData, basePath)
      const error = mergedErrors[basePath]
      return (
        <FieldRenderer
          key={basePath}
          field={field}
          value={value}
          onChange={(v) => {
            setFormData((prev) => setByPath(prev, basePath, v))
            // Clear errors for this field when user edits
            if (serverErrors[basePath]) {
              setServerErrors((prev) => { const next = { ...prev }; delete next[basePath]; return next })
            }
            if (clientErrors[basePath]) {
              setClientErrors((prev) => { const next = { ...prev }; delete next[basePath]; return next })
            }
          }}
          path={basePath}
          disabled={disabled || saving}
          error={error}
        />
      )
    },
    [formData, mergedErrors, serverErrors, clientErrors, disabled, saving],
  )

  const handleSubmit = async (statusOverride?: 'draft' | 'published') => {
    // Phase 1: Client-side Zod validation before submitting
    const clientValidationErrors = validateFormData(rootFields, formData)
    if (Object.keys(clientValidationErrors).length > 0) {
      setClientErrors(clientValidationErrors)
      const count = Object.keys(clientValidationErrors).length
      const summary = `${count} field${count !== 1 ? 's' : ''} failed validation`
      setSaveError(summary)
      toast.showToast(summary, { type: 'error', duration: 5000 })
      setScrollToError((n) => n + 1)
      return
    }

    setSaving(true)
    setSaveError(null)
    setServerErrors({})
    setClientErrors({})
    try {
      const opts = statusOverride ? { status: statusOverride } : undefined
      await onSubmit(formData, opts)
      const label = statusOverride === 'draft' ? 'Draft saved' : statusOverride === 'published' ? 'Published' : 'Saved successfully'
      const icon = statusOverride === 'published' ? 'publish' as const : 'save' as const
      toast.showToast(label, { type: 'success', icon })
    } catch (err) {
      const body = err instanceof PayloadAPIError ? err.body : null
      const parsed = body ? parseValidationErrors(body) : { fieldErrors: {}, summary: null }

      if (Object.keys(parsed.fieldErrors).length > 0) {
        setServerErrors(parsed.fieldErrors)
        const count = Object.keys(parsed.fieldErrors).length
        const summary = parsed.summary || `${count} field${count !== 1 ? 's' : ''} failed validation`
        setSaveError(summary)
        toast.showToast(summary, { type: 'error', duration: 5000 })
        setScrollToError((n) => n + 1)
      } else {
        const msg = err instanceof Error ? err.message : 'Failed to save'
        setSaveError(msg)
        toast.showToast(msg, { type: 'error', duration: 4000 })
      }
    } finally {
      setSaving(false)
    }
  }

  useImperativeHandle(ref, () => ({
    submit: () => handleSubmit(),
    submitWithStatus: (status: 'draft' | 'published') => handleSubmit(status),
    getFormData: () => formData,
  }), [handleSubmit, formData])

  useEffect(() => {
    if (scrollToError === 0) return
    const timer = setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: 0, animated: true })
    }, 100)
    return () => clearTimeout(timer)
  }, [scrollToError])

  const renderFields = (fields: ClientField[]) => {
    const groups = groupFieldsByWidth(fields)
    return groups.map((group, gi) => {
      if (group.type === 'width-row') {
        return (
          <View key={`wrow-${gi}`} style={styles.widthRow}>
            {group.fields.map((f) => {
              const path = f.name ?? `wf-${gi}`
              return (
                <View key={path} style={{ flex: parseFloat(f.admin!.width!) / 100 }}>
                  {renderField(f, path)}
                </View>
              )
            })}
          </View>
        )
      }
      const path = group.field.name ?? `field-${gi}`
      return <React.Fragment key={path}>{renderField(group.field, path)}</React.Fragment>
    })
  }

  const formDataCtx = useMemo<FormDataContextValue>(
    () => ({ formData, slug }),
    [formData, slug],
  )

  return (
    <FormDataContext.Provider value={formDataCtx}>
    <ErrorMapContext.Provider value={mergedErrors}>
    <FieldRendererContext.Provider value={renderField}>
      <Animated.ScrollView
        ref={scrollViewRef as any}
        style={styles.scroll}
        contentContainerStyle={[styles.content, contentInsetTop > 0 && { paddingTop: contentInsetTop + t.spacing.lg }]}
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic"
        onScroll={onScroll}
        scrollEventThrottle={onScroll ? scrollEventThrottle : undefined}
      >
        {draftStatus && (
          <View style={styles.statusRow}>
            <View style={[styles.statusPill, draftStatus === 'draft' ? styles.statusDraft : styles.statusPublished]}>
              <Text style={[styles.statusPillText, draftStatus === 'draft' ? styles.statusDraftText : styles.statusPublishedText]}>
                {draftStatus === 'draft' ? 'Draft' : 'Published'}
              </Text>
            </View>
          </View>
        )}

        {errorCount > 0 && (
          <View style={styles.validationBanner}>
            <Text style={styles.validationIcon}>!</Text>
            <Text style={styles.validationText}>
              {errorCount} field{errorCount !== 1 ? 's' : ''} {errorCount !== 1 ? 'have' : 'has'} errors. Please correct them below.
            </Text>
          </View>
        )}

        {renderFields(mainFields)}

        {sidebarFields.length > 0 && (
          liquidGlassAvailable && GlassView ? (
            <GlassView style={styles.glassSidebarSection} glassEffectStyle="regular">
              <View style={styles.sidebarHeader}><Text style={styles.sidebarTitle}>Details</Text></View>
              <View style={styles.sidebarBody}>{renderFields(sidebarFields)}</View>
            </GlassView>
          ) : (
            <View style={styles.sidebarSection}>
              <View style={styles.sidebarHeader}><Text style={styles.sidebarTitle}>Details</Text></View>
              <View style={styles.sidebarBody}>{renderFields(sidebarFields)}</View>
            </View>
          )
        )}

        {saveError && !errorCount && (
          <View style={styles.errorBanner}><Text style={styles.errorText}>{saveError}</Text></View>
        )}

        {/* Action buttons (Save, Delete) live in the native header toolbar
            (Stack.Toolbar) — not inline in the form. The form exposes submit()
            via ref so screen files can wire it to toolbar buttons. */}
      </Animated.ScrollView>
    </FieldRendererContext.Provider>
    </ErrorMapContext.Provider>
    </FormDataContext.Provider>
  )
})

// ===========================================================================
// Public DocumentForm — delegates to RHF or Legacy based on availability
// ===========================================================================

type FormDataContextValue = { formData: Record<string, unknown>; slug: string }

export const DocumentForm = forwardRef<DocumentFormHandle, Props>(({
  schemaMap,
  slug,
  ...rest
}, ref) => {
  const rootFields = useMemo(() => extractRootFields(schemaMap, slug), [schemaMap, slug])

  if (isRHFAvailable) {
    return <DocumentFormRHF ref={ref} rootFields={rootFields} slug={slug} schemaMap={schemaMap} {...rest} />
  }

  return <DocumentFormLegacy ref={ref} rootFields={rootFields} slug={slug} schemaMap={schemaMap} {...rest} />
})

// ===========================================================================
// Styles — iOS 26 Mail compose aesthetic
// ===========================================================================

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingHorizontal: t.spacing.lg, paddingTop: t.spacing.sm, paddingBottom: 60 },
  widthRow: { flexDirection: 'row' as const, gap: t.spacing.md },

  // Validation banner — subtle, no heavy border
  validationBanner: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fef2f2',
    borderRadius: t.borderRadius.sm, padding: t.spacing.md, marginBottom: t.spacing.md,
    gap: t.spacing.sm,
  },
  validationIcon: {
    width: 20, height: 20, borderRadius: 10, backgroundColor: t.colors.error,
    color: '#fff', fontSize: 12, fontWeight: '800', textAlign: 'center',
    lineHeight: 20, overflow: 'hidden',
  },
  validationText: { fontSize: t.fontSize.sm, color: t.colors.error, flex: 1, fontWeight: '500' },

  // Sidebar → "Details" section
  sidebarSection: {
    marginTop: t.spacing.lg, borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: t.colors.separator, paddingTop: t.spacing.sm,
  },
  glassSidebarSection: {
    marginTop: t.spacing.lg, borderRadius: t.borderRadius.md, overflow: 'hidden',
  },
  sidebarHeader: {
    paddingVertical: t.spacing.sm,
  },
  sidebarTitle: {
    fontSize: t.fontSize.sm, fontWeight: '600', color: t.colors.textMuted,
  },
  sidebarBody: { },

  errorBanner: {
    backgroundColor: t.colors.errorBackground, borderRadius: t.borderRadius.sm,
    padding: t.spacing.md, marginBottom: t.spacing.md,
  },
  errorText: { color: t.colors.error, fontSize: t.fontSize.sm },

  // Status pill (compact)
  statusRow: { flexDirection: 'row', marginBottom: t.spacing.sm },
  statusPill: { paddingHorizontal: t.spacing.sm, paddingVertical: 3, borderRadius: 6 },
  statusDraft: { backgroundColor: '#fefce8' },
  statusPublished: { backgroundColor: '#f0fdf4' },
  statusPillText: { fontSize: 11, fontWeight: '600', letterSpacing: 0.3 },
  statusDraftText: { color: t.colors.warning },
  statusPublishedText: { color: t.colors.success },
})
