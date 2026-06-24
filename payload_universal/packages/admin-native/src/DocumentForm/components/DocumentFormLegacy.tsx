/**
 * DocumentFormLegacy — useState-based DocumentForm (fallback when RHF is not
 * available).
 *
 * Extracted from the original DocumentForm.tsx (purely structural; no behavior
 * change). Rendered by the public DocumentForm when RHF is unavailable.
 */
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { Animated, Platform, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native'

import type { ClientField, FormErrors } from '../../types'
import { defaultTheme as t } from '../../theme'
import { getByPath, groupFieldsByWidth, setByPath } from '../../utils/schemaHelpers'
import { FormSection } from '../../FormSection'
import { ErrorMapContext, FieldRendererContext, FIELD_WIDTH_BREAKPOINT } from '../../fields/structural'
import { FieldRenderer } from '../../FieldRenderer'
import { useToast } from '../../Toast'
import { PayloadAPIError } from '../../utils/api'
import { FormDataContext } from '../../contexts/FormDataContext'
import { validateFormData } from '../../utils/validation'
import { nativeComponents } from '../../fields/shared'
import { evaluateFieldVisibility, useCollectionConditions } from '../../contexts/ConditionContext'
import { useListColors } from '../../hooks/useListColors'

import type { DocumentFormHandle, FormDataContextValue, Props } from '../types'
import {
  canUseNativeFormForFields,
  EDGE_TAB_MIN_WIDTH,
  parseValidationErrors,
  segmentFieldsForForm,
  splitVisibleFieldsBySidebar,
} from '../segmentation'
import { styles } from '../styles'
import { NativeFormBody } from './NativeFormBody'
import { SidebarEdgeTab } from './SidebarEdgeTab'

export const DocumentFormLegacy = forwardRef<DocumentFormHandle, Props & { rootFields: ClientField[] }>(({
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
  onOpenDetails,
  nativeForm,
  onDirtyChange,
}, ref) => {
  const [formData, setFormData] = useState<Record<string, unknown>>(initialData)
  // Legacy dirty tracking: flagged on first edit, cleared on successful save.
  const dirtyRef = useRef(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [serverErrors, setServerErrors] = useState<FormErrors>({})
  const [clientErrors, setClientErrors] = useState<FormErrors>({})
  const [scrollToError, setScrollToError] = useState(0)
  const [nativeFormCrashed, setNativeFormCrashed] = useState(false)
  const scrollViewRef = useRef<ScrollView>(null)
  const toast = useToast()

  // Client-side admin.condition registry for this collection (null when none).
  const conditions = useCollectionConditions(slug)

  const { width: windowWidthLegacy } = useWindowDimensions()
  const compactLegacy = windowWidthLegacy < FIELD_WIDTH_BREAKPOINT
  // Dark-mode aware tokens for the status pills / banners
  const { colors: pc } = useListColors()

  const { mainFields, sidebarFields } = useMemo(
    () => splitVisibleFieldsBySidebar(rootFields),
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
      // admin.condition — hide when a registered client condition returns
      // false; fields with only a hasCondition marker stay visible (fail open).
      if (conditions && !evaluateFieldVisibility(conditions, basePath, formData)) {
        return null
      }
      const value = getByPath(formData, basePath)
      const error = mergedErrors[basePath]
      return (
        <FieldRenderer
          key={basePath}
          field={field}
          value={value}
          onChange={(v) => {
            setFormData((prev) => setByPath(prev, basePath, v))
            if (!dirtyRef.current) {
              dirtyRef.current = true
              onDirtyChange?.(true)
            }
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
    [formData, mergedErrors, serverErrors, clientErrors, disabled, saving, conditions],
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
      if (dirtyRef.current) {
        dirtyRef.current = false
        onDirtyChange?.(false)
      }
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
    hasSidebarFields: sidebarFields.length > 0,
    toggleSidebar: () => onOpenDetails?.(),
  }), [handleSubmit, formData, sidebarFields.length, onOpenDetails])

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
        if (compactLegacy) {
          return (
            <React.Fragment key={`wrow-${gi}`}>
              {group.fields.map((f) => {
                const path = f.name ?? `wf-${gi}`
                return <React.Fragment key={path}>{renderField(f, path)}</React.Fragment>
              })}
            </React.Fragment>
          )
        }
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

  const formHeader = (
    <>
      {draftStatus && (
        <View style={styles.statusRow}>
          <View style={[styles.statusPill, { backgroundColor: draftStatus === 'draft' ? pc.warningBackground : pc.successBackground }]}>
            <Text style={[styles.statusPillText, { color: draftStatus === 'draft' ? pc.warning : pc.success }]}>
              {draftStatus === 'draft' ? 'Draft' : 'Published'}
            </Text>
          </View>
        </View>
      )}
      {errorCount > 0 && (
        <View style={[styles.validationBanner, { backgroundColor: pc.errorBackground }]}>
          <Text style={[styles.validationIcon, { backgroundColor: pc.error, color: pc.errorBackground }]}>!</Text>
          <Text style={[styles.validationText, { color: pc.error }]}>
            {errorCount} field{errorCount !== 1 ? 's' : ''} {errorCount !== 1 ? 'have' : 'has'} errors. Please correct them below.
          </Text>
        </View>
      )}
      {saveError && !errorCount && (
        <View style={[styles.errorBanner, { backgroundColor: pc.errorBackground }]}><Text style={[styles.errorText, { color: pc.error }]}>{saveError}</Text></View>
      )}
    </>
  )

  const mainSegments = useMemo(() => segmentFieldsForForm(mainFields), [mainFields])

  // Native SwiftUI Form path — same gating as the RHF form: ONE full-screen
  // Host > Form when every field is compatible; JS FormSections otherwise.
  // OPT-IN ONLY (nativeForm === true) — see the comment on the RHF variant:
  // the opt-out default hard-crashed natively on-device (2026-06-11,
  // Events/globals). JS path is the shipped default for ALL collections.
  const useNativeForm =
    nativeForm === true &&
    Platform.OS === 'ios' &&
    !!nativeComponents.Host &&
    !!nativeComponents.Form &&
    !!nativeComponents.Section &&
    !nativeFormCrashed &&
    canUseNativeFormForFields(mainFields)

  const fallbackFormContent = (
    <Animated.ScrollView
      ref={scrollViewRef as any}
      style={styles.scroll}
      contentContainerStyle={[styles.content, contentInsetTop > 0 && { paddingTop: contentInsetTop + t.spacing.lg }]}
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic"
      onScroll={onScroll}
      scrollEventThrottle={onScroll ? scrollEventThrottle : undefined}
    >
      {formHeader}

      {mainSegments.map((seg, i) => {
        if (seg.type === 'carveout') {
          const f = seg.field
          const path = f.name ?? `carveout-${i}`
          return (
            <View key={path} style={styles.carveoutContainer}>
              {renderField(f, path)}
            </View>
          )
        }
        return (
          <FormSection key={`section-${i}`}>
            {renderFields(seg.fields)}
          </FormSection>
        )
      })}

      {sidebarFields.length > 0 && onOpenDetails && (
        <FormSection>
          <Pressable onPress={onOpenDetails} style={styles.detailsRow}>
            <Text style={[styles.detailsRowLabel, { color: pc.primary }]}>Details</Text>
            <Text style={[styles.detailsRowChevron, { color: pc.tertiary }]}>›</Text>
          </Pressable>
        </FormSection>
      )}
    </Animated.ScrollView>
  )

  return (
    <FormDataContext.Provider value={formDataCtx}>
    <ErrorMapContext.Provider value={mergedErrors}>
    <FieldRendererContext.Provider value={renderField}>
      <View style={{ flex: 1 }}>
        {useNativeForm ? (
          <NativeFormBody
            segments={mainSegments}
            renderField={renderField}
            onOpenDetails={onOpenDetails}
            showDetailsRow={sidebarFields.length > 0}
            onCrash={(error) => {
              console.warn('[DocumentForm] Native SwiftUI Form crashed — falling back to JS form sections:', error?.message)
              setNativeFormCrashed(true)
            }}
            contentInsetTop={contentInsetTop}
            header={formHeader}
          />
        ) : (
          fallbackFormContent
        )}
        {sidebarFields.length > 0 && onOpenDetails && windowWidthLegacy >= EDGE_TAB_MIN_WIDTH && (
          <SidebarEdgeTab onPress={onOpenDetails} colors={pc as unknown as Record<string, string>} />
        )}
      </View>
    </FieldRendererContext.Provider>
    </ErrorMapContext.Provider>
    </FormDataContext.Provider>
  )
})
