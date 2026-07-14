// Right-docked overlay panel: version history + side-by-side diff + restore.
//
// Versions are server-side only, so this fetches them over REST on mount. The
// left column lists versions (newest first); selecting one diffs its snapshot
// against the live document on the right. Restore posts the version back and
// asks the caller to refresh.
import { useEffect, useMemo, useRef, useState } from 'react'
import { formatUpdatedAt } from '../../lib/doc'
import { listVersions, restoreVersion, type VersionDoc } from './api'
import { diffDocs, formatValue, type DiffRow } from './diff'

type Props = {
  slug: string
  docId: string
  serverURL: string
  token: string
  currentDoc: Record<string, unknown>
  versionsLabel?: string
  onClose: () => void
  onRestored: () => void
}

function statusOf(version: Record<string, unknown>): string | null {
  const s = version._status
  return s === 'draft' || s === 'published' ? s : null
}

export function VersionsPanel({
  slug,
  docId,
  serverURL,
  token,
  currentDoc,
  versionsLabel,
  onClose,
  onRestored,
}: Props) {
  const [versions, setVersions] = useState<VersionDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const [hideUnchanged, setHideUnchanged] = useState(true)
  const [confirming, setConfirming] = useState(false)
  const [restoreError, setRestoreError] = useState<string | null>(null)
  const [restoring, setRestoring] = useState(false)
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(null)
    listVersions(serverURL, token, slug, docId)
      .then((docs) => {
        if (!alive) return
        setVersions(docs)
        setSelectedId(docs[0]?.id ?? null)
      })
      .catch((err: unknown) => {
        if (alive) setError(err instanceof Error ? err.message : 'Failed to load versions.')
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [serverURL, token, slug, docId])

  useEffect(() => () => {
    if (confirmTimer.current) clearTimeout(confirmTimer.current)
  }, [])

  const selected = useMemo(
    () => versions.find((v) => v.id === selectedId) ?? null,
    [versions, selectedId],
  )

  const allRows = useMemo<DiffRow[]>(
    () => (selected ? diffDocs(selected.version, currentDoc) : []),
    [selected, currentDoc],
  )
  const unchangedCount = useMemo(
    () => allRows.filter((r) => r.status === 'unchanged').length,
    [allRows],
  )
  const rows = hideUnchanged ? allRows.filter((r) => r.status !== 'unchanged') : allRows

  // Reset restore confirmation whenever the selection changes.
  useEffect(() => {
    setConfirming(false)
    setRestoreError(null)
    if (confirmTimer.current) clearTimeout(confirmTimer.current)
  }, [selectedId])

  const onRestoreClick = async () => {
    if (!selected) return
    if (!confirming) {
      setConfirming(true)
      confirmTimer.current = setTimeout(() => setConfirming(false), 5000)
      return
    }
    if (confirmTimer.current) clearTimeout(confirmTimer.current)
    setConfirming(false)
    setRestoring(true)
    setRestoreError(null)
    try {
      await restoreVersion(serverURL, token, slug, selected.id)
      onRestored()
      onClose()
    } catch (err) {
      setRestoreError(err instanceof Error ? err.message : 'Restore failed.')
      setRestoring(false)
    }
  }

  return (
    <div className="versions-panel">
      <div className="versions-header">
        <span className="versions-title">{versionsLabel ?? 'Versions'}</span>
        <button className="link versions-close" onClick={onClose} aria-label="Close versions">
          ×
        </button>
      </div>

      {loading ? (
        <div className="empty">Loading…</div>
      ) : error ? (
        <div className="versions-error">{error}</div>
      ) : versions.length === 0 ? (
        <div className="empty">No versions yet.</div>
      ) : (
        <div className="versions-body">
          <div className="versions-list">
            {versions.map((v) => {
              const status = statusOf(v.version)
              return (
                <button
                  key={v.id}
                  className={`version-row${v.id === selectedId ? ' selected' : ''}`}
                  onClick={() => setSelectedId(v.id)}
                >
                  <span className="version-when">{formatUpdatedAt(v.updatedAt)}</span>
                  <span className="version-tags">
                    {status && (
                      <span className={`version-badge status-${status}`}>{status}</span>
                    )}
                    {v.autosave && <span className="version-badge autosave">autosave</span>}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="versions-diff">
            <div className="diff-toolbar">
              <label className="diff-toggle">
                <input
                  type="checkbox"
                  checked={hideUnchanged}
                  onChange={(e) => setHideUnchanged(e.target.checked)}
                />
                Hide unchanged
              </label>
              {hideUnchanged && unchangedCount > 0 && (
                <span className="diff-hidden-note">{unchangedCount} unchanged hidden</span>
              )}
            </div>

            {rows.length === 0 ? (
              <div className="empty">
                {allRows.length === 0
                  ? 'Nothing to compare.'
                  : 'No changes between this version and the current document.'}
              </div>
            ) : (
              <div className="diff-table">
                <div className="diff-head-row">
                  <span className="diff-head">Field</span>
                  <span className="diff-head">This version</span>
                  <span className="diff-head">Current</span>
                </div>
                {rows.map((row) => (
                  <div key={row.key} className={`diff-row diff-${row.status}`}>
                    <span className="diff-key">{row.key}</span>
                    <span className="diff-val">{formatValue(row.aValue)}</span>
                    <span className="diff-val">{formatValue(row.bValue)}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="versions-actions">
              <button
                className={`restore-btn${confirming ? ' confirm' : ''}`}
                onClick={onRestoreClick}
                disabled={!selected || restoring}
              >
                {restoring
                  ? 'Restoring…'
                  : confirming
                    ? 'Confirm restore?'
                    : 'Restore this version'}
              </button>
              {restoreError && <span className="versions-error inline">{restoreError}</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
