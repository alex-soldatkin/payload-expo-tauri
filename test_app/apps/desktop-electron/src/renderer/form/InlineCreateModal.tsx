// Minimal inline-create modal: creates a NEW document in a target collection
// from a small text-only form. Field components don't carry the AdminSchema,
// so v1 renders the collection's likely title field plus any extra text fields
// passed by the caller — a fuller schema-driven form is a later pass. Writes
// through useValidatedMutations so client-side validation errors surface inline.
import { useEffect, useState } from 'react'
import { useLocalDB, useValidatedMutations } from '@payload-universal/local-db'

type Props = {
  /** Target collection slug to create the document in. */
  slug: string
  /** The collection's likely title field (rendered as the first text input). */
  titleKey?: string
  /** Extra plain-text field names to render as additional inputs. */
  extraTextFields?: string[]
  /** Fires with the new doc id after a successful create. */
  onCreated: (id: string) => void
  /** Close without creating (Esc / backdrop / Cancel). */
  onClose: () => void
}

export function InlineCreateModal({
  slug,
  titleKey = 'title',
  extraTextFields = [],
  onCreated,
  onClose,
}: Props) {
  const localDB = useLocalDB()
  // v1 is a text-only form; no field defs are passed so the validator only
  // guards what the collection requires globally (fail-open on missing config).
  const { create, errors } = useValidatedMutations(localDB, slug)

  const [values, setValues] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const keys = [titleKey, ...extraTextFields.filter((k) => k !== titleKey)]

  // Esc closes; the effect owns the listener so it's torn down on unmount.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const setField = (key: string, next: string) =>
    setValues((prev) => ({ ...prev, [key]: next }))

  const submit = async () => {
    setBusy(true)
    setFormError(null)
    try {
      const data: Record<string, unknown> = { _status: undefined }
      for (const key of keys) {
        const v = values[key]
        if (v != null && v !== '') data[key] = v
      }
      const result = await create(data)
      if (result.success && result.id) {
        onCreated(result.id)
      } else if (!result.success) {
        const first = Object.entries(result.errors)[0]
        setFormError(first ? `${first[0]}: ${first[1]}` : 'Validation failed.')
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Create failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      {/* Stop propagation so clicks inside the surface don't hit the backdrop. */}
      <div className="modal-surface" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">New {slug}</span>
          <button type="button" className="link" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          {keys.map((key) => (
            <label key={key} className="field">
              <span className="field-label">{key}</span>
              <input
                className="input"
                autoFocus={key === titleKey}
                value={values[key] ?? ''}
                onChange={(e) => setField(key, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void submit()
                }}
              />
              {errors[key] && <div className="field-error">{errors[key]}</div>}
            </label>
          ))}
          {formError && <div className="field-error">{formError}</div>}
        </div>
        <div className="modal-actions">
          <button type="button" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="primary"
            onClick={() => void submit()}
            disabled={busy}
          >
            {busy ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}
