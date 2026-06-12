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
import { Animated, Modal, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import { PanelRight } from 'lucide-react-native'

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
import { deepEqual } from './utils/diff'
import { extractRootFields, getByPath, getFieldLabel, groupFieldsByWidth, setByPath, splitFieldsBySidebar } from './utils/schemaHelpers'
import { FormSection } from './FormSection'
import { ErrorMapContext, FieldRendererContext, FIELD_WIDTH_BREAKPOINT } from './fields/structural'
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
import { NativeFormContext, nativeComponents } from './fields/shared'
import { NativeHost } from './fields/NativeHost'
import { evaluateFieldVisibility, useCollectionConditions } from './contexts/ConditionContext'
import { useListColors } from './hooks/useListColors'

// ---------------------------------------------------------------------------
// Form field segmentation — split top-level fields into runs of compatible
// fields (grouped in a single Section) and individual incompatible fields
// (each gets its own carve-out Section).
// ---------------------------------------------------------------------------

/** Field types whose native views crash inside a SwiftUI Form cell.
 *  UITextView (richText) and FlatList (join) conflict with List self-sizing. */
export const FORM_CARVE_OUT_TYPES = new Set(['richText', 'join'])

/**
 * Recursively check whether a field (or any of its descendants) contains
 * an incompatible type that needs a carve-out. Structural fields (tabs,
 * group, collapsible, row, array, blocks) are checked through their children.
 */
const containsIncompatibleField = (field: ClientField): boolean => {
  if (FORM_CARVE_OUT_TYPES.has(field.type)) return true
  const f = field as any
  if (field.type === 'tabs') {
    return (f.tabs ?? []).some((tab: any) => (tab.fields ?? []).some(containsIncompatibleField))
  }
  if (field.type === 'group' || field.type === 'collapsible' || field.type === 'row') {
    return (f.fields ?? []).some(containsIncompatibleField)
  }
  if (field.type === 'array') {
    return (f.fields ?? []).some(containsIncompatibleField)
  }
  if (field.type === 'blocks') {
    return (f.blocks ?? []).some((block: any) => (block.fields ?? []).some(containsIncompatibleField))
  }
  return false
}

type FieldSegment =
  | { type: 'compatible'; fields: ClientField[] }
  | { type: 'carveout'; field: ClientField }

/**
 * Split a flat field array into segments for native Form rendering.
 * Consecutive compatible fields are grouped into one Section.
 * Fields that ARE or CONTAIN incompatible types get their own carve-out Section.
 */
const segmentFieldsForForm = (fields: ClientField[]): FieldSegment[] => {
  const segments: FieldSegment[] = []
  let compatibleRun: ClientField[] = []

  const flushRun = () => {
    if (compatibleRun.length > 0) {
      segments.push({ type: 'compatible', fields: compatibleRun })
      compatibleRun = []
    }
  }

  for (const field of fields) {
    if (containsIncompatibleField(field)) {
      flushRun()
      segments.push({ type: 'carveout', field })
    } else {
      compatibleRun.push(field)
    }
  }
  flushRun()

  return segments
}

/**
 * Whether ALL of the given fields (and their descendants) can live inside a
 * single native SwiftUI Form. False as soon as any field needs a carve-out
 * (richText/join own their scroll/layout and crash inside Form cells).
 *
 * The native Form path only activates when this returns true: ONE
 * full-screen NativeHost > Form wrapping all Sections. Standalone Sections
 * (outside a Form/List) crash, and multiple Forms inside one ScrollView are
 * not supported — when carve-outs would be needed we keep the JS
 * FormSection path, which intentionally mimics grouped lists.
 */
export const canUseNativeFormForFields = (fields: ClientField[]): boolean =>
  fields.every((field) => !containsIncompatibleField(field))

// Error boundary: catches native Form rendering crashes and auto-falls back
class FormCrashBoundary extends React.Component<
  { children: React.ReactNode; onCrash: (error: Error) => void },
  { crashed: boolean }
> {
  state = { crashed: false }
  static getDerivedStateFromError() { return { crashed: true } }
  componentDidCatch(error: Error) { this.props.onCrash(error) }
  render() { return this.state.crashed ? null : this.props.children }
}

// ---------------------------------------------------------------------------
// NativeFormBody — single full-screen SwiftUI Form (iOS only)
// ---------------------------------------------------------------------------

/**
 * Renders ALL field segments inside ONE NativeHost > Form. Only mounted when
 * `canUseNativeFormForFields` passed (every segment is 'compatible') — never
 * standalone Sections, never multiple Forms in one ScrollView.
 *
 * Wrapped in FormCrashBoundary: a JS render crash flips the parent back to
 * the stable JS FormSection path. Native-side crashes cannot be caught here
 * — on-device verification is required before shipping this path enabled.
 */
const NativeFormBody: React.FC<{
  segments: FieldSegment[]
  renderField: (field: ClientField, basePath: string) => React.ReactNode
  onOpenDetails?: () => void
  showDetailsRow: boolean
  onCrash: (error: Error) => void
  contentInsetTop: number
  header: React.ReactNode
}> = ({ segments, renderField, onOpenDetails, showDetailsRow, onCrash, contentInsetTop, header }) => {
  const NativeForm = nativeComponents.Form
  const NativeSection = nativeComponents.Section
  const NativeButton = nativeComponents.Button

  if (!NativeForm || !NativeSection) return null

  // Modifiers are factory calls from the registry — null-checked, never
  // object literals.
  const formModifiers = nativeComponents.scrollDismissesKeyboard
    ? [nativeComponents.scrollDismissesKeyboard('interactively')]
    : undefined

  return (
    <NativeFormContext.Provider value={true}>
      <FormCrashBoundary onCrash={onCrash}>
        <View
          style={[
            styles.nativeFormContainer,
            contentInsetTop > 0 && { paddingTop: contentInsetTop + t.spacing.sm },
          ]}
        >
          {header ? <View style={styles.nativeFormHeader}>{header}</View> : null}
          {/* matchContents intentionally omitted (false): the Form is a
              full-screen scrolling container sized by the flex:1 parent. */}
          <NativeHost matchContents={false} style={styles.nativeFormHost}>
            <NativeForm modifiers={formModifiers}>
              {segments.map((seg, i) => {
                // Guarded upstream by canUseNativeFormForFields — skip
                // defensively if a carve-out ever slips through.
                if (seg.type !== 'compatible') return null
                return (
                  <NativeSection key={`section-${i}`}>
                    {seg.fields.map((f, fi) => {
                      const path = f.name ?? `field-${fi}`
                      return <React.Fragment key={path}>{renderField(f, path)}</React.Fragment>
                    })}
                  </NativeSection>
                )
              })}
              {showDetailsRow && onOpenDetails && NativeButton ? (
                <NativeSection>
                  <NativeButton label="Details" onPress={onOpenDetails} />
                </NativeSection>
              ) : null}
            </NativeForm>
          </NativeHost>
        </View>
      </FormCrashBoundary>
    </NativeFormContext.Provider>
  )
}

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
  /** Whether this form has sidebar fields (admin.position: 'sidebar'). */
  hasSidebarFields: boolean
  /** Open the sidebar details sheet/panel. */
  toggleSidebar: () => void
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
  /** Called when the user taps "Details" to open the sidebar sheet. */
  onOpenDetails?: () => void
  /** When true, renders ONLY sidebar fields (for the details sheet). */
  sidebarOnly?: boolean
  /** Called when a field is edited (clears validation errors incrementally). */
  onFieldEdit?: (fieldPath: string) => void
  /**
   * Called whenever the form's dirty state flips (unsaved edits exist /
   * cleared). Drives save-button enabled state in the host screen's toolbar.
   * Fires false again after a successful submit (baseline resets to the
   * saved values).
   */
  onDirtyChange?: (dirty: boolean) => void
  /**
   * OPT-IN: render with a native SwiftUI Form when ALL fields are compatible
   * (no richText/join anywhere in the tree). Defaults to FALSE — pass
   * `nativeForm={true}` explicitly to enable the native path.
   *
   * 2026-06-11 on-device crash: with the previous opt-out default, every
   * collection WITHOUT a richText/join carve-out (Events, the SiteSettings/
   * Footer globals, …) took the native Form path and HARD-CRASHED natively
   * on open (no JS stack — FormCrashBoundary only catches JS render errors,
   * not native ones). Collections WITH carve-outs (Posts, Users, Pages)
   * rendered fine because they always take the JS FormSection path. Do not
   * re-enable by default until the native side is debugged on-device.
   */
  nativeForm?: boolean
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
// Sidebar edge tab — Apple Notes/Freeform-style affordance on the content's
// right edge that opens the Details (sidebar fields) sheet. Rendered only on
// wide layouts (>= EDGE_TAB_MIN_WIDTH); phones keep the header toolbar
// button, where a persistent edge tab would crowd the content.
// ===========================================================================

const EDGE_TAB_MIN_WIDTH = 768

const SidebarEdgeTab: React.FC<{ onPress: () => void; colors: Record<string, string> }> = ({ onPress, colors }) => {
  const inner = (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel="Open details"
      style={edgeTabStyles.press}
    >
      <PanelRight size={18} color={colors.primary} />
    </Pressable>
  )
  if (liquidGlassAvailable && GlassView) {
    return (
      <View style={edgeTabStyles.container} pointerEvents="box-none">
        <GlassView style={edgeTabStyles.glass} isInteractive glassEffectStyle="regular">
          {inner}
        </GlassView>
      </View>
    )
  }
  return (
    <View style={edgeTabStyles.container} pointerEvents="box-none">
      <View style={[edgeTabStyles.glass, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth }]}>
        {inner}
      </View>
    </View>
  )
}

const edgeTabStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 0,
    top: '42%',
    zIndex: 30,
  },
  glass: {
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
    overflow: 'hidden',
  },
  press: {
    paddingVertical: 18,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
})

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

// ---------------------------------------------------------------------------

// Optional: BlurView for translucent panel background
let BlurView: React.ComponentType<any> | null = null
try {
  BlurView = require('expo-blur').BlurView
} catch { /* not available */ }

// Try to import safe area insets for proper panel positioning
let useSafeAreaInsets: (() => { top: number; bottom: number; left: number; right: number }) | null = null
try {
  useSafeAreaInsets = require('react-native-safe-area-context').useSafeAreaInsets
} catch { /* not available */ }

const INSPECTOR_WIDTH = 320
const INSPECTOR_MARGIN = 12
const DISMISS_THRESHOLD = 100 // px swipe right to dismiss

/**
 * Floating inspector panel — hovers over form content.
 * - No backdrop: content behind remains interactive
 * - Draggable: PanResponder lets user reposition horizontally
 * - Swipe right to dismiss
 * - Glass/blur background with rounded corners on all sides
 * - Positioned within the content area (parent View, not full-screen)
 */
const InspectorPanel: React.FC<{
  visible: boolean
  onClose: () => void
  renderFields: (fields: ClientField[]) => React.ReactNode
  sidebarFields: ClientField[]
}> = ({ visible, onClose, renderFields, sidebarFields }) => {
  const { width: screenWidth } = useWindowDimensions()
  const { dark, colors: pc } = useListColors()
  const insets = useSafeAreaInsets ? useSafeAreaInsets() : { top: 0, bottom: 0 }
  const topInset = Math.max(insets.top + 56, 70)
  const bottomInset = Math.max(insets.bottom + 50, 60)

  // Width adapts to screen: use ~40% of screen width on tablets, max 380px
  // This ensures date pickers, relationship fields etc. aren't cut off.
  const panelWidth = Math.min(Math.max(300, Math.round(screenWidth * 0.4)), 380)

  const panX = useRef(new Animated.Value(screenWidth)).current
  const lastX = useRef(screenWidth)
  // Track if we've ever mounted — once true, stays true to avoid
  // re-rendering the form content below when the panel is dismissed.
  const hasBeenVisible = useRef(false)

  useEffect(() => {
    const target = screenWidth - panelWidth - INSPECTOR_MARGIN
    if (visible) {
      hasBeenVisible.current = true
      lastX.current = target
      Animated.spring(panX, {
        toValue: target,
        useNativeDriver: true,
        damping: 24,
        stiffness: 200,
        mass: 0.8,
      }).start()
    } else {
      lastX.current = screenWidth
      Animated.spring(panX, {
        toValue: screenWidth,
        useNativeDriver: true,
        damping: 24,
        stiffness: 200,
        mass: 0.8,
      }).start()
    }
  }, [visible, screenWidth, panelWidth, panX])

  // PanResponder for drag + swipe-to-dismiss
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > 10 && Math.abs(gs.dx) > Math.abs(gs.dy),
      onPanResponderGrant: () => {
        panX.stopAnimation((val) => { lastX.current = val })
        panX.setOffset(lastX.current)
        panX.setValue(0)
      },
      onPanResponderMove: Animated.event([null, { dx: panX }], { useNativeDriver: false }),
      onPanResponderRelease: (_, gs) => {
        panX.flattenOffset()
        const finalX = lastX.current + gs.dx

        if (gs.dx > DISMISS_THRESHOLD || gs.vx > 0.5) {
          onClose()
          return
        }

        const clamped = Math.max(INSPECTOR_MARGIN, Math.min(finalX, screenWidth - panelWidth - INSPECTOR_MARGIN))
        lastX.current = clamped
        Animated.spring(panX, {
          toValue: clamped,
          useNativeDriver: true,
          damping: 24,
          stiffness: 200,
          mass: 0.8,
        }).start()
      },
    }),
  ).current

  // Don't render until first opened — but once rendered, keep alive
  // (just offscreen) to avoid re-rendering the form below.
  if (!hasBeenVisible.current) return null

  const panelBg = liquidGlassAvailable && GlassView
    ? React.createElement(GlassView as React.ComponentType<any>, {
        style: StyleSheet.absoluteFill,
        glassEffectStyle: 'regular',
      })
    : BlurView
      ? <BlurView style={StyleSheet.absoluteFill} intensity={80} tint="systemThickMaterial" />
      : <View style={[StyleSheet.absoluteFill, { backgroundColor: dark ? 'rgba(30, 30, 30, 0.97)' : 'rgba(255, 255, 255, 0.97)' }]} />

  return (
    <Animated.View
      style={[
        inspectorStyles.panel,
        { borderColor: pc.hairline },
        { width: panelWidth, top: topInset, bottom: bottomInset, transform: [{ translateX: panX }] },
      ]}
      pointerEvents={visible ? 'auto' : 'none'}
      {...panResponder.panHandlers}
    >
      {panelBg}

      {/* Drag handle */}
      <View style={inspectorStyles.dragHandle}>
        <View style={[inspectorStyles.dragPill, { backgroundColor: pc.tertiary }]} />
      </View>

      {/* Header */}
      <View style={inspectorStyles.header}>
        <Text style={[inspectorStyles.headerTitle, { color: pc.text }]}>Details</Text>
        <Pressable onPress={onClose} hitSlop={12}>
          <Text style={[inspectorStyles.closeButton, { color: pc.primary }]}>Done</Text>
        </Pressable>
      </View>

      {/* Scrollable content */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={inspectorStyles.content}
        keyboardShouldPersistTaps="handled"
      >
        <FormSection>
          {renderFields(sidebarFields)}
        </FormSection>
      </ScrollView>
    </Animated.View>
  )
}

const inspectorStyles = StyleSheet.create({
  panel: {
    position: 'absolute',
    // top and bottom set dynamically from safe area insets
    overflow: 'hidden',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 32,
  },
  dragHandle: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
  dragPill: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1f1f1f',
  },
  closeButton: {
    fontSize: 17,
    fontWeight: '500',
    color: t.colors.primary,
  },
  content: {
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 40,
  },
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

// ===========================================================================
// Public DocumentForm — delegates to RHF or Legacy based on availability
// ===========================================================================

type FormDataContextValue = { formData: Record<string, unknown>; slug: string }

/**
 * Latch `initialData` to a referentially-stable object.
 *
 * Screens commonly pass `initialData={doc ?? {}}` (or a fresh RxDB
 * `toJSON()` clone) — a NEW object identity on every parent render even
 * when the contents are identical. `useForm` only captures `defaultValues`
 * at mount, but react-hook-form keeps the live props on `control._options`
 * every render, so an unstable identity leaks into every dirty-check /
 * reset consumer and can re-trigger state from anything keyed on it
 * (Maximum update depth exceeded, details sheet 2026-06-11). The latch
 * returns the SAME reference for new-but-deep-equal objects, so identity
 * churn upstream becomes a no-op; genuinely different data still flows
 * through (a single identity change, then stable again).
 */
const useStableInitialData = (
  initialData: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined => {
  const ref = useRef(initialData)
  if (ref.current !== initialData && !deepEqual(ref.current, initialData)) {
    ref.current = initialData
  }
  return ref.current
}

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

// ===========================================================================
// Styles — iOS 26 Mail compose aesthetic
// ===========================================================================

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingHorizontal: t.spacing.lg, paddingTop: t.spacing.sm, paddingBottom: 60 },
  widthRow: { flexDirection: 'row' as const, gap: t.spacing.md },
  carveoutContainer: { paddingHorizontal: t.spacing.lg, paddingVertical: t.spacing.sm },

  // Native SwiftUI Form path — full-screen Host; the Form scrolls natively.
  nativeFormContainer: { flex: 1 },
  nativeFormHost: { flex: 1 },
  nativeFormHeader: { paddingHorizontal: t.spacing.lg },


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

  // "Details ›" row — taps to open sidebar sheet
  detailsRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: t.spacing.md,
  },
  detailsRowLabel: { fontSize: t.fontSize.md, color: t.colors.primary, fontWeight: '500' },
  detailsRowChevron: { fontSize: 20, color: t.colors.textMuted },

  // Sidebar formSheet
  sheetContainer: { flex: 1, backgroundColor: t.colors.background },
  sheetHeader: {
    flexDirection: 'row', justifyContent: 'flex-end',
    paddingHorizontal: t.spacing.lg, paddingTop: t.spacing.md, paddingBottom: t.spacing.xs,
  },
  sheetDone: { fontSize: t.fontSize.md, fontWeight: '600', color: t.colors.primary },
})
