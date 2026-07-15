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
import { VersionsPanel } from './versions/VersionsPanel'
import { DocMenu } from './DocMenu'
import { useAutosave } from './useAutosave'
import { docTitle, formatUpdatedAt } from '../lib/doc'

/** Keys never shown or written by the form. */
const INTERNAL_KEYS = new Set(['id', 'createdAt', 'updatedAt'])

/** Compact HH:MM for the "Autosaved 14:32" status label. */
function formatAutosaveTime(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })
}

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
  token: string
  rootFields: SchemaField[]
  hasDrafts: boolean
  onClose: () => void
  onDeleted: () => void
  /** Reports the doc's display title (tab labels). */
  onTitle?: (title: string) => void
  /** Called after a successful Duplicate with the new doc's id. */
  onDuplicated?: (newId: string) => void
  /** Reports the form's dirty state (feeds the workspace dirty-tab guard). */
  onDirtyChange?: (dirty: boolean) => void
}

export function DocumentForm({ slug, id, serverURL, token, rootFields, hasDrafts, onClose, onDeleted, onTitle, onDuplicated, onDirtyChange }: Props) {
  const localDB = useLocalDB()
  const { doc, loading } = useLocalDocument(localDB, slug, id)
  const { create, update, remove, errors, clearFieldError } = useValidatedMutations(
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
  const [showVersions, setShowVersions] = useState(false)
  const seededFor = useRef<string | null>(null)

  // Seed/reseed from the live doc — but never clobber unsaved edits.
  useEffect(() => {
    if (!doc) return
    if (formState.isDirty && seededFor.current === id) return
    reset(editableValues(doc as Record<string, unknown>))
    seededFor.current = id
  }, [doc, id, formState.isDirty, reset])

  useEffect(() => {
    if (doc) onTitle?.(docTitle(doc as Record<string, unknown>))
  }, [doc, onTitle])

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

  // Duplicate: clone the editable subset, suffix a title-ish field with
  // ' (Copy)', force draft status when the collection supports drafts, and
  // create a fresh doc via the validated create mutation.
  const duplicate = async () => {
    if (!doc) return
    setBusy(true)
    setSubmitError(null)
    try {
      const clone = editableValues(doc as Record<string, unknown>)
      for (const key of ['title', 'name']) {
        if (typeof clone[key] === 'string') {
          clone[key] = `${clone[key] as string} (Copy)`
          break
        }
      }
      clone._status = hasDrafts ? 'draft' : clone._status
      const result = await create(clone)
      if (result.success && result.id) {
        onDuplicated?.(result.id)
      } else if (!result.success) {
        const first = Object.entries(result.errors)[0]
        setSubmitError(first ? `${first[0]}: ${first[1]}` : 'Duplicate failed.')
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Duplicate failed.')
    } finally {
      setBusy(false)
    }
  }

  // Autosave — mirrors mobile gating: only when the collection has drafts, the
  // doc is not published, and the form is dirty. Saves keep the current
  // _status (no forced 'draft'/'published').
  const autosave = useAutosave({
    enabled: hasDrafts,
    isDirty: formState.isDirty,
    getValues,
    currentStatus: (doc as Record<string, unknown> | undefined)?._status,
    save: async (values) => {
      const result = await update(id, values, doc as Record<string, unknown>)
      if (result.success) reset(getValues(), { keepValues: true })
      return result.success
    },
  })

  // Feed the workspace dirty-tab guard (guard itself lives elsewhere).
  useEffect(() => {
    onDirtyChange?.(formState.isDirty)
  }, [formState.isDirty, onDirtyChange])

  const record = (doc ?? {}) as Record<string, unknown>
  const engine = { slug, serverURL, token, docId: id, control, getValues, setValue, errors, onEdit: clearFieldError }

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
          {hasDrafts && (
            <button className="no-drag" onClick={() => setShowVersions((v) => !v)}>
              Versions
            </button>
          )}
          <DocMenu
            disabled={busy}
            items={[
              { label: 'Duplicate', onSelect: () => void duplicate() },
              { label: 'Delete', danger: true, onSelect: () => void del() },
            ]}
          />
          {Boolean(record._locallyModified) && <span className="dot" title="Locally modified" />}
        </div>

        {showVersions && (
          <VersionsPanel
            slug={slug}
            docId={id}
            serverURL={serverURL}
            token={token}
            currentDoc={record}
            onClose={() => setShowVersions(false)}
            onRestored={() => setShowVersions(false)}
          />
        )}

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
          {hasDrafts && autosave.state === 'saving' && (
            <span className="doc-meta">Autosaving…</span>
          )}
          {hasDrafts && autosave.state === 'saved' && autosave.lastSavedAt && (
            <span className="doc-meta">
              Autosaved {formatAutosaveTime(autosave.lastSavedAt)}
            </span>
          )}
          {hasDrafts && autosave.state === 'error' && (
            <span className="editor-error">Autosave failed</span>
          )}
          <div className="spacer" />
        </div>
      </div>
    </FormEngineProvider>
  )
}
