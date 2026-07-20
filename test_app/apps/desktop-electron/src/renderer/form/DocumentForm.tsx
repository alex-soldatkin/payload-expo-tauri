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
import { uploadToCollection } from './upload'
import { VersionsPanel } from './versions/VersionsPanel'
import { DocMenu, type DocMenuItem } from './DocMenu'
import { getActionComponents } from './registry'
import { ActionBoundary } from './ui-shim/ActionBoundary'
import { useAutosave } from './useAutosave'
import { docTitle, formatUpdatedAt } from '../lib/doc'
import { resolveHandler, type ActionContext } from '../lib/actions'
import { useToast } from '../components/toast/ToastProvider'

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
  /** True for upload collections — enables the file picker + multipart upload. */
  isUpload?: boolean
  onClose: () => void
  onDeleted: () => void
  /** Reports the doc's display title (tab labels). */
  onTitle?: (title: string) => void
  /** Called after a successful Duplicate with the new doc's id. */
  onDuplicated?: (newId: string) => void
  /** Navigate this tab to a different doc id in the same collection — used
   *  after an upload creates the real server doc (replacing the local stub). */
  onReplaceDoc?: (newId: string) => void
  /** Reports the form's dirty state (feeds the workspace dirty-tab guard). */
  onDirtyChange?: (dirty: boolean) => void
  /**
   * Schema-declared edit actions for this collection (metadata only). Wired
   * from WorkspaceMain; defaults to none. Menu items dispatch through the
   * desktop ActionRegistry with `docs = [current doc]`.
   */
  editActions?: Array<{ key: string; label: string; destructive?: boolean }>
}

export function DocumentForm({ slug, id, serverURL, token, rootFields, hasDrafts, isUpload = false, onClose, onDeleted, onTitle, onDuplicated, onReplaceDoc, onDirtyChange, editActions = [] }: Props) {
  const localDB = useLocalDB()
  const { showToast } = useToast()
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
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
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

  // Upload a binary to this (upload) collection. The JSON sync push can't carry
  // file bytes, so the file goes straight to the server via multipart POST with
  // the current editable field values in the `_payload` envelope (so required
  // fields like `alt` are satisfied). The server assigns the real doc id; we
  // upsert the returned doc into the local DB, drop the local stub this "New
  // document" flow created, and navigate the tab to the real doc.
  const onUploadFile = async (file: File) => {
    setUploading(true)
    setUploadError(null)
    try {
      const values = editableValues(getValues())
      // Never send upload-managed metadata back as user input.
      for (const k of ['filename', 'mimeType', 'filesize', 'url', 'sizes', 'thumbnailURL', 'width', 'height', 'focalX', 'focalY']) {
        delete values[k]
      }

      // If this doc already exists on the server (it has a file), REPLACE that
      // file in place (PATCH) so we don't spawn a duplicate. A stub from "New
      // document" has no file and no server record yet, so it's a create.
      const record = doc as Record<string, unknown> | undefined
      const existingOnServer = Boolean(record?.filename) && !record?._locallyModified
      const uploaded = await uploadToCollection(
        file,
        slug,
        serverURL,
        token,
        values,
        existingOnServer ? id : undefined,
      )

      // Make the doc available locally right away (next sync pull would also
      // bring it, but upsert avoids a blank editor in the meantime).
      const collection = localDB ? await localDB.ensureCollection(slug) : null
      if (collection) {
        await collection.upsert({
          ...(uploaded as Record<string, unknown>),
          _deleted: false,
          // Server-authored: not a local edit, so it won't be re-pushed.
          _locallyModified: false,
        } as never)
        // Remove the unsyncable local stub (different id) after a fresh create.
        if (uploaded.id !== id) {
          const stub = await collection.findOne(id).exec()
          if (stub) await stub.remove()
        }
      }

      if (uploaded.id !== id) onReplaceDoc?.(uploaded.id)
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed.')
    } finally {
      setUploading(false)
    }
  }

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-picking the same file
    if (file) void onUploadFile(file)
  }

  // Dispatch a schema-declared edit action through the desktop ActionRegistry
  // with docs = [current doc]. `duplicatePost` is remapped to the generic
  // Duplicate so the two share one implementation. Destructive actions confirm
  // first. Unregistered keys are surfaced by the disabled menu item below.
  const runEditAction = async (key: string, destructive?: boolean) => {
    if (!doc) return
    if (key === 'duplicatePost') {
      await duplicate()
      return
    }
    const handler = resolveHandler(slug, 'edit', key)
    if (!handler) return
    if (destructive && !window.confirm('Run this action?')) return
    const ctx: ActionContext = {
      slug,
      docs: [doc as Record<string, unknown>],
      update: async (docId, data) => {
        await update(docId, data, doc as Record<string, unknown>)
      },
      remove,
      serverURL,
      toast: (message, opts) => showToast(message, opts),
    }
    setBusy(true)
    try {
      await handler(ctx)
    } finally {
      setBusy(false)
    }
  }

  // Built-in Duplicate/Delete plus every schema-declared edit action. Unknown
  // keys (no registered handler, and not the built-in Duplicate) render as a
  // disabled item explaining the gap.
  const menuItems: DocMenuItem[] = [
    { label: 'Duplicate', onSelect: () => void duplicate() },
    { label: 'Delete', danger: true, onSelect: () => void del() },
    ...editActions.map((a): DocMenuItem => {
      const known = a.key === 'duplicatePost' || Boolean(resolveHandler(slug, 'edit', a.key))
      // DocMenu has no disabled-item affordance; surface the gap in the label
      // and toast on select instead of silently doing nothing.
      return {
        label: known ? a.label : `${a.label} (unavailable)`,
        danger: a.destructive,
        onSelect: known
          ? () => void runEditAction(a.key, a.destructive)
          : () => showToast('Handler not registered.', { type: 'error' }),
      }
    }),
  ]

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
      <div
        className="main"
        onKeyDown={(e) => {
          // Cmd/Ctrl+S saves keeping the current _status (scoped to this form's
          // DOM so only the pane being edited saves in split layouts).
          if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 's') {
            e.preventDefault()
            void save()()
          }
        }}
      >
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
            items={menuItems}
            passthrough={
              getActionComponents(slug, 'edit').length > 0
                ? getActionComponents(slug, 'edit').map((Action, i) => (
                    <ActionBoundary key={i} label={`${slug}.edit[${i}]`}>
                      <Action />
                    </ActionBoundary>
                  ))
                : undefined
            }
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

        {isUpload && (
          <div className="upload-panel">
            <input ref={fileInputRef} type="file" hidden onChange={onPickFile} />
            {record.filename ? (
              <>
                <span className="doc-meta">
                  {String(record.filename)}
                  {typeof record.filesize === 'number'
                    ? ` · ${Math.max(1, Math.round(Number(record.filesize) / 1024))} KB`
                    : ''}
                  {record.url ? (
                    <>
                      {' · '}
                      <a
                        href={new URL(String(record.url), serverURL).toString()}
                        target="_blank"
                        rel="noreferrer"
                      >
                        open
                      </a>
                    </>
                  ) : null}
                </span>
                <button type="button" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
                  {uploading ? 'Uploading…' : 'Replace file'}
                </button>
              </>
            ) : (
              <>
                <span className="doc-meta">
                  {uploading ? 'Uploading…' : 'No file yet — choose a file to upload'}
                </span>
                <button type="button" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
                  Choose file
                </button>
              </>
            )}
            {uploadError && <span className="editor-error">{uploadError}</span>}
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
