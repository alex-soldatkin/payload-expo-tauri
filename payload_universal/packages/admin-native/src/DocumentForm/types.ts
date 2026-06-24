/**
 * DocumentForm — shared prop/domain types.
 *
 * Extracted from the original DocumentForm.tsx (purely structural; no behavior
 * change). The folder index re-exports the public symbols (DocumentFormHandle).
 */
import type { ClientField, FormErrors, SerializedSchemaMap } from '../types'

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

export type Props = {
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

export type FieldSegment =
  | { type: 'compatible'; fields: ClientField[] }
  | { type: 'carveout'; field: ClientField }

/** Internal duplicate of contexts/FormDataContext's value shape, used by the
 *  RHF + Legacy form variants for the context provider memo. */
export type FormDataContextValue = { formData: Record<string, unknown>; slug: string }
