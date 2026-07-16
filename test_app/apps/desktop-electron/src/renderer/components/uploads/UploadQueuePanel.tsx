// Status-bar upload-queue indicator + popover. Surfaces the local-first media
// upload queue (RxDB `_pending_uploads` via UploadQueueManager): shows a count
// while items are queued, a spinner while uploading, and a compact popover that
// lists each item (filename, target collection, status, error) with per-item
// retry (failed only) and remove. Reuses the .picker-menu popover convention
// and dismisses on Esc / outside-click, like DocContextMenu.
import { useEffect, useRef, useState } from 'react'
import { useLocalDB, usePendingUploads } from '@payload-universal/local-db'
import type { PendingUploadItem, UploadStatus } from '@payload-universal/local-db'

const STATUS_LABEL: Record<UploadStatus, string> = {
  pending: 'Queued',
  uploading: 'Uploading',
  completed: 'Done',
  error: 'Failed',
}

export function UploadQueuePanel() {
  const localDB = useLocalDB()
  const {
    items,
    pendingCount,
    uploadingCount,
    errorCount,
    completedCount,
    isProcessing,
    retry,
    remove,
    retryAll,
    clearCompleted,
  } = usePendingUploads(localDB)

  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  // Active (not-yet-done) work drives the indicator visibility + count.
  const activeCount = pendingCount + uploadingCount + errorCount

  // Dismiss on Esc / outside click while open.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onDown)
    }
  }, [open])

  // Indicator hidden when nothing is queued (and the panel isn't pinned open by
  // leftover completed rows the user may want to clear).
  if (activeCount === 0 && completedCount === 0) return null

  const dot = errorCount > 0 ? 'error' : isProcessing ? 'syncing' : 'online'
  const label =
    activeCount > 0
      ? `${activeCount} upload${activeCount === 1 ? '' : 's'}`
      : 'Uploads'

  return (
    <div className="cell upload-indicator" ref={rootRef}>
      <button
        type="button"
        className="upload-indicator-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        title="Pending media uploads"
      >
        <span className={`status-dot ${dot}`} />
        {isProcessing && <span className="upload-spinner" aria-hidden="true" />}
        {label}
      </button>

      {open && (
        <div className="picker-menu upload-queue-panel" onMouseDown={(e) => e.stopPropagation()}>
          <div className="upload-queue-head">
            <span>Upload queue</span>
            <div className="upload-queue-head-actions">
              {errorCount > 0 && (
                <button type="button" onClick={() => void retryAll()}>
                  Retry all
                </button>
              )}
              {completedCount > 0 && (
                <button type="button" onClick={() => void clearCompleted()}>
                  Clear done
                </button>
              )}
            </div>
          </div>

          {items.length === 0 ? (
            <div className="upload-queue-empty">Queue is empty.</div>
          ) : (
            <div className="upload-queue-list">
              {items.map((item) => (
                <UploadRow key={item.id} item={item} onRetry={retry} onRemove={remove} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function UploadRow({
  item,
  onRetry,
  onRemove,
}: {
  item: PendingUploadItem
  onRetry: (id: string) => Promise<void>
  onRemove: (id: string) => Promise<void>
}) {
  return (
    <div className={`upload-row status-${item.status}`}>
      <div className="upload-row-main">
        <span className="upload-row-name" title={item.fileName}>
          {item.fileName}
        </span>
        <span className="upload-row-meta">
          {item.targetCollection}
          {' · '}
          <span className={`upload-row-status status-${item.status}`}>
            {STATUS_LABEL[item.status]}
          </span>
        </span>
        {item.status === 'error' && item.error && (
          <span className="upload-row-error" title={item.error}>
            {item.error}
          </span>
        )}
      </div>
      <div className="upload-row-actions">
        {item.status === 'error' && (
          <button type="button" onClick={() => void onRetry(item.id)} title="Retry upload">
            Retry
          </button>
        )}
        {item.status !== 'uploading' && (
          <button
            type="button"
            className="danger"
            onClick={() => void onRemove(item.id)}
            title="Remove from queue"
          >
            Remove
          </button>
        )}
      </div>
    </div>
  )
}
