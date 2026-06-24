/**
 * DocumentFormRHF — react-hook-form-powered DocumentForm (Phase 2 + 3).
 *
 * Extracted from the original DocumentForm.tsx (purely structural; no behavior
 * change). Rendered by the public DocumentForm when RHF is available.
 */
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { Animated, Platform, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native'

import type { ClientField, FormErrors } from '../../types'
import { defaultTheme as t } from '../../theme'
import { groupFieldsByWidth } from '../../utils/schemaHelpers'
import { FormSection } from '../../FormSection'
import { ErrorMapContext, FieldRendererContext, FIELD_WIDTH_BREAKPOINT } from '../../fields/structural'
import { useToast } from '../../Toast'
import { PayloadAPIError } from '../../utils/api'
import { FormDataContext } from '../../contexts/FormDataContext'
import { FormProvider, usePayloadForm } from '../../hooks/usePayloadForm'
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
import { RHFFieldBridge } from './RHFFieldBridge'
import { SidebarEdgeTab } from './SidebarEdgeTab'

export const DocumentFormRHF = forwardRef<DocumentFormHandle, Props & { rootFields: ClientField[] }>(({
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
  sidebarOnly = false,
  nativeForm,
  onDirtyChange,
}, ref) => {
  const scrollViewRef = useRef<ScrollView>(null)
  const [scrollToError, setScrollToError] = useState(0)
  const [saveError, setSaveError] = useState<string | null>(null)
  // Set when the native SwiftUI Form crashes during JS render — flips this
  // form to the stable JS FormSection path for the rest of its lifetime.
  const [nativeFormCrashed, setNativeFormCrashed] = useState(false)
  const toast = useToast()

  // Client-side admin.condition registry for this collection (null when the
  // app registered none — evaluation is skipped entirely in that case).
  const conditions = useCollectionConditions(slug)

  const { width: windowWidth } = useWindowDimensions()
  const compact = windowWidth < FIELD_WIDTH_BREAKPOINT
  // Dark-mode aware tokens for the status pills / banners
  const { colors: pc } = useListColors()

  const { mainFields, sidebarFields } = useMemo(
    () => splitVisibleFieldsBySidebar(rootFields),
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

  // Live form data for condition evaluation. Kept null when no conditions
  // are registered so renderField's deps stay referentially stable and
  // per-field re-render isolation is preserved.
  const conditionData = conditions ? formData : null

  // Phase 2: Controller-based renderField — each field gets its own Controller
  // so only the edited field re-renders, not the entire form tree.
  const renderField = useCallback(
    (field: ClientField, basePath: string): React.ReactNode => {
      // admin.condition — hide fields whose registered client condition
      // returns false. Fields with only a hasCondition marker (no registered
      // condition) stay visible: fail open.
      if (conditions && conditionData && !evaluateFieldVisibility(conditions, basePath, conditionData)) {
        return null
      }
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
    [control, disabled, isSubmitting, mergedErrors, clearServerError, conditions, conditionData],
  )

  // Submit handler with server error handling
  const handleSubmit = async (statusOverride?: 'draft' | 'published') => {
    setSaveError(null)
    setServerErrors({})
    try {
      await submit(statusOverride)
      // Re-baseline RHF on the just-saved values so isDirty returns false
      // (and onDirtyChange fires) until the next edit. keepValues avoids
      // touching the rendered field state.
      methods.reset(methods.getValues(), { keepValues: true })
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
    hasSidebarFields: sidebarFields.length > 0,
    toggleSidebar: () => onOpenDetails?.(),
  }), [handleSubmit, getFormData, isDirty, sidebarFields.length, onOpenDetails])

  // Surface dirty-state flips to the host screen (toolbar save button).
  useEffect(() => {
    onDirtyChange?.(isDirty)
  }, [isDirty, onDirtyChange])

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
        if (compact) {
          // Small screen: render each field full-width, stacked vertically
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

  // Status + error banner (rendered above the form fields)
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

  // ── Segmented FormSection rendering ──
  // When sidebarOnly, render sidebar fields as the main content.
  const fieldsToRender = sidebarOnly ? sidebarFields : mainFields
  const mainSegments = useMemo(() => segmentFieldsForForm(fieldsToRender), [fieldsToRender])

  // ── Native SwiftUI Form path ──
  // Single full-screen Host > Form wrapping ALL Sections — only when every
  // field is compatible (no richText/join carve-outs needed anywhere).
  // Standalone Sections outside a Form crash, so partial usage is never
  // attempted: any carve-out keeps the whole form on the JS path below.
  //
  // OPT-IN ONLY (nativeForm === true): the previous `nativeForm ?? true`
  // default hard-crashed natively on-device (2026-06-11) for exactly the
  // collections without carve-outs (Events docs, SiteSettings/Footer
  // globals). The crash is native-side (no JS stack; FormCrashBoundary
  // cannot catch it) — likely raw RN views (relationship rows, array/upload
  // editors, chip lists) mounted as direct children of SwiftUI Form/Section
  // cells fighting the List's self-sizing. Re-enabling requires native-side
  // debugging; until then every collection ships on the JS FormSection path.
  const useNativeForm =
    nativeForm === true &&
    Platform.OS === 'ios' &&
    !!nativeComponents.Host &&
    !!nativeComponents.Form &&
    !!nativeComponents.Section &&
    !nativeFormCrashed &&
    canUseNativeFormForFields(fieldsToRender)

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

      {/* Group fields into iOS Settings-style FormSections.
          Compatible segments (text, select, checkbox, date, etc.) are grouped
          in rounded FormSection containers. Carve-out fields (richText, join,
          structural fields containing them) render standalone with padding. */}
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

      {/* Show "Details" row — opens native sheet */}
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

  const formContent = (
    <FormDataContext.Provider value={formDataCtx}>
    <ErrorMapContext.Provider value={mergedErrors}>
    <FieldRendererContext.Provider value={renderField}>
      <View style={{ flex: 1 }}>
        {useNativeForm ? (
          <NativeFormBody
            segments={mainSegments}
            renderField={renderField}
            onOpenDetails={onOpenDetails}
            showDetailsRow={!sidebarOnly && sidebarFields.length > 0}
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
        {/* Wide layouts: Notes-style edge tab opens the Details sheet from
            the panel edge itself; the header toolbar button covers phones. */}
        {!sidebarOnly && sidebarFields.length > 0 && onOpenDetails && windowWidth >= EDGE_TAB_MIN_WIDTH && (
          <SidebarEdgeTab onPress={onOpenDetails} colors={pc as unknown as Record<string, string>} />
        )}
      </View>
    </FieldRendererContext.Provider>
    </ErrorMapContext.Provider>
    </FormDataContext.Provider>
  )

  // Wrap in FormProvider so nested components can use useFormContext / usePayloadField
  return FormProvider ? (
    <FormProvider {...methods}>{formContent}</FormProvider>
  ) : formContent
})
