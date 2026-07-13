// Generic JSON editor for a single document. The doc streams in reactively via
// useLocalDocument, so WebSocket pulls landing while you edit are visible in
// the read-only header (id / updatedAt) and — until you touch the textarea —
// re-seed the editable JSON.
import { useEffect, useRef, useState } from 'react'
import { useLocalDB, useLocalDocument, useLocalMutations } from '@payload-universal/local-db'
import { editableFields, formatUpdatedAt } from '../lib/doc'

type Props = {
  slug: string
  id: string
  onClose: () => void
  onDeleted: () => void
}

export function DocumentEditor({ slug, id, onClose, onDeleted }: Props) {
  const localDB = useLocalDB()
  const { doc, loading } = useLocalDocument(localDB, slug, id)
  const { update, remove } = useLocalMutations(localDB, slug)

  const [text, setText] = useState('')
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const seededFor = useRef<string | null>(null)

  // Re-seed the textarea from the live doc — but only while the user hasn't
  // started editing, so incoming syncs don't clobber unsaved work.
  useEffect(() => {
    if (!doc) return
    if (dirty && seededFor.current === id) return
    setText(JSON.stringify(editableFields(doc as Record<string, unknown>), null, 2))
    seededFor.current = id
    setDirty(false)
  }, [doc, id, dirty])

  // Reset editing state when switching documents.
  useEffect(() => {
    setDirty(false)
    setError(null)
    setSaved(false)
    seededFor.current = null
  }, [id])

  const save = async () => {
    setError(null)
    setSaved(false)
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(text)
    } catch (err) {
      setError(`Invalid JSON: ${err instanceof Error ? err.message : String(err)}`)
      return
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      setError('Document body must be a JSON object.')
      return
    }
    setBusy(true)
    try {
      await update(id, parsed)
      setDirty(false)
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.')
    } finally {
      setBusy(false)
    }
  }

  const del = async () => {
    setBusy(true)
    try {
      await remove(id)
      onDeleted()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed.')
      setBusy(false)
    }
  }

  const record = (doc ?? {}) as Record<string, unknown>

  return (
    <div className="main">
      <div className="main-header">
        <button className="link" onClick={onClose}>
          ‹ Back
        </button>
        <div className="spacer" />
        {(record._locallyModified as boolean) && <span className="dot" title="Locally modified" />}
      </div>

      <div className="editor">
        <div className="editor-meta">
          <span>
            id <code>{String(record.id ?? id)}</code>
          </span>
          <span>updated {formatUpdatedAt(record.updatedAt)}</span>
        </div>

        <div className="editor-body">
          {!localDB || (loading && !doc) ? (
            <div className="empty">Loading…</div>
          ) : !doc ? (
            <div className="empty">This document no longer exists locally.</div>
          ) : (
            <textarea
              value={text}
              spellCheck={false}
              onChange={(e) => {
                setText(e.target.value)
                setDirty(true)
                setSaved(false)
                setError(null)
              }}
            />
          )}
        </div>

        <div className="editor-actions">
          <button className="primary" onClick={save} disabled={busy || !doc || !dirty}>
            {busy ? 'Saving…' : 'Save'}
          </button>
          {error && <span className="editor-error">{error}</span>}
          {saved && !dirty && <span className="editor-saved">Saved locally</span>}
          <div className="spacer" />
          <button className="danger" onClick={del} disabled={busy || !doc}>
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}
