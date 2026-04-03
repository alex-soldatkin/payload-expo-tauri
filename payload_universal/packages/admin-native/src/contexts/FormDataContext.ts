/**
 * Form data context — gives nested field components (e.g. JoinField) access
 * to the full document data including the document ID.
 *
 * Extracted into a standalone file to avoid a require cycle:
 *   DocumentForm → FieldRenderer → fields → join → DocumentForm
 */
import { createContext, useContext } from 'react'

export type FormDataContextValue = {
  /** Current form data (full document). */
  formData: Record<string, unknown>
  /** The collection or global slug. */
  slug: string
}

export const FormDataContext = createContext<FormDataContextValue | null>(null)

/** Hook to read the parent form's document data from nested field components. */
export const useFormData = (): FormDataContextValue | null => useContext(FormDataContext)
