// Bulk-actions toolbar: renders when the list selection is non-empty. Shows the
// selection count, a Clear button, then one button per schema listAction for the
// collection (wired through the desktop ActionRegistry) plus a built-in Delete.
// Destructive actions are styled `.danger` and gated behind window.confirm.
// Unregistered action keys render as disabled buttons with an explanatory title.
import { useState } from 'react'
import type { NativeActionMeta } from '@payload-universal/admin-schema'
import { resolveHandler, type ActionContext } from '../../../lib/actions'
import { getActionComponents } from '../../../form/registry'
import { DocInfoScopeProvider, SelectionScopeProvider } from '../../../form/ui-shim/scopes'
import { ActionBoundary } from '../../../form/ui-shim/ActionBoundary'
import { useActionSteps } from '../../preview/ActionSteps'
import { useToast } from '../../toast/ToastProvider'

type Props = {
  slug: string
  serverURL: string
  /** The currently-selected docs (already resolved from ids). */
  selected: Record<string, unknown>[]
  /** Schema-declared list actions for this collection. */
  actions: NativeActionMeta[]
  update: (id: string, data: Record<string, unknown>) => Promise<void>
  remove: (id: string) => Promise<void>
  onClear: () => void
  /** Reset the list's column config (passthrough ResetColumns actions). */
  onResetColumns?: () => void
}

export function SelectionBar({
  slug,
  serverURL,
  selected,
  actions,
  update,
  remove,
  onClear,
  onResetColumns,
}: Props) {
  const { showToast } = useToast()
  const steps = useActionSteps()
  const [running, setRunning] = useState<string | null>(null)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)

  const count = selected.length
  const busy = running !== null

  const buildContext = (): ActionContext => ({
    slug,
    docs: selected,
    update,
    remove,
    serverURL,
    steps,
    toast: (message, opts) => showToast(message, opts),
    onProgress: (done, total) => setProgress({ done, total }),
  })

  const runAction = async (meta: NativeActionMeta) => {
    const handler = resolveHandler(slug, 'list', meta.key)
    if (!handler) return
    const handlerOwnsConfirm = meta.key === 'bulkArchive' // steps-based flows confirm themselves
    if (meta.destructive && !handlerOwnsConfirm && !window.confirm(`${meta.label} — ${count} item${count !== 1 ? 's' : ''}?`)) {
      return
    }
    setRunning(meta.key)
    setProgress(null)
    try {
      await handler(buildContext())
    } finally {
      setRunning(null)
      setProgress(null)
      onClear()
    }
  }

  const runDelete = async () => {
    if (!window.confirm(`Delete ${count} item${count !== 1 ? 's' : ''}? This cannot be undone.`)) {
      return
    }
    setRunning('__delete')
    setProgress({ done: 0, total: count })
    let done = 0
    for (const doc of selected) {
      const id = String(doc.id ?? '')
      if (id) {
        try {
          await remove(id)
          done++
        } catch {
          // skip
        }
      }
      setProgress({ done, total: count })
    }
    showToast(`Deleted ${done} item${done !== 1 ? 's' : ''}.`, { type: 'success' })
    setRunning(null)
    setProgress(null)
    onClear()
  }

  return (
    <div className="selection-bar">
      <span className="selection-count">{count} selected</span>
      <button type="button" className="link selection-clear" onClick={onClear} disabled={busy}>
        Clear
      </button>
      <span className="selection-hint">Esc clears</span>
      <div className="selection-actions">
        {actions.map((meta) => {
          const registered = Boolean(resolveHandler(slug, 'list', meta.key))
          const active = running === meta.key
          return (
            <button
              key={meta.key}
              type="button"
              className={`chip selection-action${meta.destructive ? ' danger' : ''}`}
              disabled={!registered || busy}
              title={registered ? undefined : 'handler not registered'}
              onClick={() => void runAction(meta)}
            >
              {active && progress ? `${progress.done}/${progress.total}…` : meta.label}
            </button>
          )
        })}
        <button
          type="button"
          className="chip selection-action danger"
          disabled={busy}
          onClick={() => void runDelete()}
        >
          {running === '__delete' && progress ? `${progress.done}/${progress.total}…` : 'Delete'}
        </button>
        {/* Codegen passthrough bulk actions (config listMenuItems): the
            ORIGINAL admin components, reading the selection via the shim's
            useSelection and rendering inline as chips. */}
        {getActionComponents(slug, 'list').length > 0 && (
          <DocInfoScopeProvider value={{ slug, docId: null, serverURL }}>
            <SelectionScopeProvider
              value={{ slug, docs: selected, totalDocs: count, clear: onClear, resetColumns: onResetColumns }}
            >
              {getActionComponents(slug, 'list').map((Action, i) => (
                <span key={i} className="selection-action passthrough">
                  <ActionBoundary label={`${slug}.list[${i}]`}>
                    <Action />
                  </ActionBoundary>
                </span>
              ))}
            </SelectionScopeProvider>
          </DocInfoScopeProvider>
        )}
      </div>
    </div>
  )
}
