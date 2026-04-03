/**
 * DocumentForm – renders a complete form for a collection document or global
 * using the admin schema field definitions.
 *
 * Splits fields into main and sidebar sections (matching Payload's web admin).
 * On mobile, sidebar fields render in a "Details" section below the main fields.
 *
 * Handles API validation errors:
 *  - Parses Payload's { errors: [{ data: { errors: [{ path, message }] } }] } format
 *  - Maps errors to individual fields (red highlight + message beneath)
 *  - Shows a toast with the error summary
 *
 * Exposes a ref with { submit() } so the parent can trigger save from a header button.
 */
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Animated, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

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
import { extractRootFields, getByPath, setByPath, splitFieldsBySidebar } from './schemaHelpers'
import { ErrorMapContext, FieldRendererContext } from './fields/structural'
import { FieldRenderer } from './FieldRenderer'
import { useToast } from './Toast'
import { PayloadAPIError } from './api'
import { FormDataContext } from './FormDataContext'

// Re-export for backwards compatibility
export { FormDataContext, useFormData } from './FormDataContext'
export type { FormDataContextValue } from './FormDataContext'

export type DocumentFormHandle = {
  submit: () => void
  /** Submit with explicit _status override (for draft/publish flows). */
  submitWithStatus: (status: 'draft' | 'published') => void
  /** Get current form data without submitting. */
  getFormData: () => Record<string, unknown>
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

export const DocumentForm = forwardRef<DocumentFormHandle, Props>(({
  schemaMap,
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
  const [scrollToError, setScrollToError] = useState(0) // bump to trigger scroll
  const scrollViewRef = useRef<ScrollView>(null)
  const toast = useToast()

  const rootFields = useMemo(() => extractRootFields(schemaMap, slug), [schemaMap, slug])

  // Split into main and sidebar sections
  const { mainFields, sidebarFields } = useMemo(
    () => splitFieldsBySidebar(rootFields),
    [rootFields],
  )

  // Merge external errors + server errors
  const mergedErrors = useMemo(() => ({
    ...externalErrors,
    ...serverErrors,
  }), [externalErrors, serverErrors])

  // Count of fields with errors (for toast message)
  const errorCount = Object.keys(serverErrors).length

  // Provide a stable renderField function via context for structural fields
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
            // Clear the server error for this field when user edits it
            if (serverErrors[basePath]) {
              setServerErrors((prev) => {
                const next = { ...prev }
                delete next[basePath]
                return next
              })
            }
          }}
          path={basePath}
          disabled={disabled || saving}
          error={error}
        />
      )
    },
    [formData, mergedErrors, serverErrors, disabled, saving],
  )

  const handleSubmit = async (statusOverride?: 'draft' | 'published') => {
    setSaving(true)
    setSaveError(null)
    setServerErrors({})
    try {
      const opts = statusOverride ? { status: statusOverride } : undefined
      await onSubmit(formData, opts)
      const label = statusOverride === 'draft' ? 'Draft saved' : statusOverride === 'published' ? 'Published' : 'Saved successfully'
      const icon = statusOverride === 'published' ? 'publish' as const : 'save' as const
      toast.showToast(label, { type: 'success', icon })
    } catch (err) {
      // Parse Payload's validation error response
      const body = err instanceof PayloadAPIError ? err.body : null
      const parsed = body ? parseValidationErrors(body) : { fieldErrors: {}, summary: null }

      if (Object.keys(parsed.fieldErrors).length > 0) {
        setServerErrors(parsed.fieldErrors)
        const count = Object.keys(parsed.fieldErrors).length
        const summary = parsed.summary || `${count} field${count !== 1 ? 's' : ''} failed validation`
        setSaveError(summary)
        toast.showToast(summary, { type: 'error', duration: 5000 })
        // Trigger scroll to error banner
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

  // Expose submit to parent via ref (for header save button)
  useImperativeHandle(ref, () => ({
    submit: () => handleSubmit(),
    submitWithStatus: (status: 'draft' | 'published') => handleSubmit(status),
    getFormData: () => formData,
  }), [handleSubmit, formData])

  // Auto-scroll to the error banner at the top when validation errors arrive
  useEffect(() => {
    if (scrollToError === 0) return
    const timer = setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: 0, animated: true })
    }, 100)
    return () => clearTimeout(timer)
  }, [scrollToError])

  const renderFields = (fields: ClientField[]) =>
    fields.map((field, i) => {
      const path = field.name ?? `field-${i}`
      return (
        <React.Fragment key={path}>
          {renderField(field, path)}
        </React.Fragment>
      )
    })

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
        {/* Draft / Published status pill */}
        {draftStatus && (
          <View style={styles.statusRow}>
            <View style={[styles.statusPill, draftStatus === 'draft' ? styles.statusDraft : styles.statusPublished]}>
              <Text style={[styles.statusPillText, draftStatus === 'draft' ? styles.statusDraftText : styles.statusPublishedText]}>
                {draftStatus === 'draft' ? 'Draft' : 'Published'}
              </Text>
            </View>
          </View>
        )}

        {/* Validation error summary banner */}
        {errorCount > 0 && (
          <View style={styles.validationBanner}>
            <Text style={styles.validationIcon}>!</Text>
            <Text style={styles.validationText}>
              {errorCount} field{errorCount !== 1 ? 's' : ''} {errorCount !== 1 ? 'have' : 'has'} errors. Please correct them below.
            </Text>
          </View>
        )}

        {/* Main fields */}
        {renderFields(mainFields)}

        {/* Sidebar fields → "Details" section on mobile */}
        {sidebarFields.length > 0 && (
          liquidGlassAvailable && GlassView ? (
            <GlassView style={styles.glassSidebarSection} glassEffectStyle="regular">
              <View style={styles.sidebarHeader}>
                <Text style={styles.sidebarTitle}>Details</Text>
              </View>
              <View style={styles.sidebarBody}>
                {renderFields(sidebarFields)}
              </View>
            </GlassView>
          ) : (
            <View style={styles.sidebarSection}>
              <View style={styles.sidebarHeader}>
                <Text style={styles.sidebarTitle}>Details</Text>
              </View>
              <View style={styles.sidebarBody}>
                {renderFields(sidebarFields)}
              </View>
            </View>
          )
        )}

        {saveError && !errorCount && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{saveError}</Text>
          </View>
        )}

        {draftStatus ? (
          <View style={styles.dualButtonRow}>
            <Pressable
              style={[styles.draftBtn, (disabled || saving) && styles.submitDisabled]}
              onPress={() => handleSubmit('draft')}
              disabled={disabled || saving}
            >
              {saving ? (
                <ActivityIndicator color={t.colors.text} />
              ) : (
                <Text style={styles.draftBtnText}>Save Draft</Text>
              )}
            </Pressable>
            <Pressable
              style={[styles.submitBtn, styles.publishBtn, (disabled || saving) && styles.submitDisabled]}
              onPress={() => handleSubmit('published')}
              disabled={disabled || saving}
            >
              {saving ? (
                <ActivityIndicator color={t.colors.primaryText} />
              ) : (
                <Text style={styles.submitText}>Publish</Text>
              )}
            </Pressable>
          </View>
        ) : (
          <Pressable
            style={[styles.submitBtn, (disabled || saving) && styles.submitDisabled]}
            onPress={() => handleSubmit()}
            disabled={disabled || saving}
          >
            {saving ? (
              <ActivityIndicator color={t.colors.primaryText} />
            ) : (
              <Text style={styles.submitText}>{submitLabel}</Text>
            )}
          </Pressable>
        )}

        {onDelete && (
          <Pressable style={styles.deleteBtn} onPress={onDelete}>
            <Text style={styles.deleteText}>Delete</Text>
          </Pressable>
        )}
      </Animated.ScrollView>
    </FieldRendererContext.Provider>
    </ErrorMapContext.Provider>
    </FormDataContext.Provider>
  )
})

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: t.spacing.lg, paddingBottom: 120 },

  // Validation banner
  validationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderRadius: t.borderRadius.sm,
    borderWidth: 1,
    borderColor: '#fecaca',
    padding: t.spacing.md,
    marginBottom: t.spacing.lg,
    gap: t.spacing.sm,
  },
  validationIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: t.colors.error,
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 22,
    overflow: 'hidden',
  },
  validationText: { fontSize: t.fontSize.sm, color: t.colors.error, flex: 1, fontWeight: '500' },

  // Sidebar → "Details" section
  sidebarSection: {
    marginTop: t.spacing.xl,
    backgroundColor: t.colors.surface,
    borderRadius: t.borderRadius.md,
    borderWidth: 1,
    borderColor: t.colors.border,
    overflow: 'hidden',
  },
  glassSidebarSection: {
    marginTop: t.spacing.xl,
    borderRadius: t.borderRadius.md,
    overflow: 'hidden',
  },
  sidebarHeader: {
    paddingHorizontal: t.spacing.lg,
    paddingVertical: t.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.colors.separator,
    backgroundColor: '#fafafa',
  },
  sidebarTitle: {
    fontSize: t.fontSize.sm,
    fontWeight: '700',
    color: t.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sidebarBody: {
    padding: t.spacing.lg,
  },

  // Error & actions
  errorBanner: {
    backgroundColor: t.colors.errorBackground,
    borderRadius: t.borderRadius.sm,
    padding: t.spacing.md,
    marginBottom: t.spacing.lg,
  },
  errorText: { color: t.colors.error, fontSize: t.fontSize.sm },
  submitBtn: {
    backgroundColor: t.colors.primary,
    borderRadius: t.borderRadius.sm,
    paddingVertical: t.spacing.md,
    alignItems: 'center',
    marginTop: t.spacing.md,
  },
  submitDisabled: { opacity: 0.5 },
  submitText: { color: t.colors.primaryText, fontSize: t.fontSize.md, fontWeight: '600' },
  deleteBtn: {
    alignItems: 'center',
    paddingVertical: t.spacing.lg,
    marginTop: t.spacing.xl,
  },
  deleteText: { color: t.colors.destructive, fontSize: t.fontSize.md, fontWeight: '600' },

  // Status pill
  statusRow: { flexDirection: 'row', marginBottom: t.spacing.md },
  statusPill: {
    paddingHorizontal: t.spacing.md,
    paddingVertical: t.spacing.xs,
    borderRadius: t.borderRadius.sm,
  },
  statusDraft: { backgroundColor: '#fefce8' },
  statusPublished: { backgroundColor: '#f0fdf4' },
  statusPillText: { fontSize: t.fontSize.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  statusDraftText: { color: t.colors.warning },
  statusPublishedText: { color: t.colors.success },

  // Dual draft / publish buttons
  dualButtonRow: { flexDirection: 'row', gap: t.spacing.sm, marginTop: t.spacing.md },
  draftBtn: {
    flex: 1,
    backgroundColor: t.colors.surface,
    borderRadius: t.borderRadius.sm,
    borderWidth: 1,
    borderColor: t.colors.border,
    paddingVertical: t.spacing.md,
    alignItems: 'center',
  },
  draftBtnText: { color: t.colors.text, fontSize: t.fontSize.md, fontWeight: '600' },
  publishBtn: { flex: 1 },
})
