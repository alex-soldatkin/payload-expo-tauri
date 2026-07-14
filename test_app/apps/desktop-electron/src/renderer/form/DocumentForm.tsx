// Schema-driven document form: RHF holds one nested value object seeded from
// the live local doc; useValidatedMutations validates against the admin schema
// and writes the FULL object (incrementalPatch merges top-level keys only).
import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import {
  useLocalDB,
  useLocalDocument,
  useValidatedMutations,
} from '@payload-universal/local-db'
import type { SchemaField } from './types'
import { FormEngineProvider, renderField } from './FieldRenderer'
import { formatUpdatedAt } from '../lib/doc'

/** Keys never shown or written by the form. */
const INTERNAL_KEYS = new Set(['id', 'createdAt', 'updatedAt'])

function editableValues(doc: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(doc)) {
    if (INTERNAL_KEYS.has(k)) continue
    if (k.startsWith('_') && k !== '_status') continue
    out[k] = v
  }
  return out
}

type Props = {
  slug: string
  id: string
  serverURL: string
  rootFields: SchemaField[]
  hasDrafts: boolean
  onClose: () => void
  onDeleted: () => void
}

export function DocumentForm({ slug, id, serverURL, rootFields, hasDrafts, onClose, onDeleted }: Props) {
  const localDB = useLocalDB()
  const { doc, loading } = useLocalDocument(localDB, slug, id)
  const { update, remove, errors, clearFieldError } = useValidatedMutations(
    localDB,
    slug,
    rootFields as never[],
  )

  const { control, getValues, setValue, handleSubmit, reset, formState } = useForm<
    Record<string, unknown>
  >({ defaultValues: {} })

  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const seededFor = useRef<string | null>(null)

  // Seed/reseed from the live doc — but never clobber unsaved edits.
  useEffect(() => {
    if (!doc) return
    if (formState.isDirty && seededFor.current === id) return
    reset(editableValues(doc as Record<string, unknown>))
    seededFor.current = id
  }, [doc, id, formState.isDirty, reset])

  const { mainFields, sidebarFields } = useMemo(() => {
    const main: SchemaField[] = []
    const side: SchemaField[] = []
    for (const f of rootFields) {
      if (f.admin?.position === 'sidebar') side.push(f)
      else main.push(f)
    }
    return { mainFields: main, sidebarFields: side }
  }, [rootFields])

  const save = (status?: 'draft' | 'published') =>
    handleSubmit(async (values) => {
      setBusy(true)
      setSaved(false)
      setSubmitError(null)
      try {
        const data = status ? { ...values, _status: status } : values
        const result = await update(id, data, doc as Record<string, unknown>)
        if (result.success) {
          setSaved(true)
          reset(getValues(), { keepValues: true })
        } else {
          const first = Object.entries(result.errors)[0]
          setSubmitError(first ? `${first[0]}: ${first[1]}` : 'Validation failed.')
        }
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : 'Save failed.')
      } finally {
        setBusy(false)
      }
    })

  const del = async () => {
    setBusy(true)
    try {
      await remove(id)
      onDeleted()
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Delete failed.')
      setBusy(false)
    }
  }

  const record = (doc ?? {}) as Record<string, unknown>
  const engine = { slug, serverURL, docId: id, control, getValues, setValue, errors, onEdit: clearFieldError }

  if (!localDB || (loading && !doc)) return <div className="empty">Loading…</div>
  if (!doc) return <div className="empty">This document no longer exists locally.</div>

  return (
    <FormEngineProvider value={engine}>
      <div className="main">
        <div className="main-header">
          <button className="link" onClick={onClose}>‹ Back</button>
          <span className="doc-meta">
            id <code>{String(record.id ?? id)}</code> · updated {formatUpdatedAt(record.updatedAt)}
          </span>
          <div className="spacer" />
          {Boolean(record._locallyModified) && <span className="dot" title="Locally modified" />}
        </div>

        {typeof record.url === 'string' &&
          String(record.mimeType ?? '').startsWith('image/') && (
            <div className="media-preview">
              <img
                src={new URL(record.url, serverURL).toString()}
                alt={String(record.alt ?? record.filename ?? '')}
              />
            </div>
          )}

        <div className="form-layout">
          <div className="form-main">{mainFields.map((f) => renderField(f, ''))}</div>
          {sidebarFields.length > 0 && (
            <div className="form-sidebar">{sidebarFields.map((f) => renderField(f, ''))}</div>
          )}
        </div>

        <div className="editor-actions">
          {hasDrafts ? (
            <>
              <button onClick={save('draft')} disabled={busy}>Save draft</button>
              <button className="primary" onClick={save('published')} disabled={busy}>
                Publish
              </button>
            </>
          ) : (
            <button className="primary" onClick={save()} disabled={busy}>
              {busy ? 'Saving…' : 'Save'}
            </button>
          )}
          {submitError && <span className="editor-error">{submitError}</span>}
          {saved && !submitError && <span className="editor-saved">Saved locally</span>}
          <div className="spacer" />
          <button className="danger" onClick={del} disabled={busy}>Delete</button>
        </div>
      </div>
    </FormEngineProvider>
  )
}
