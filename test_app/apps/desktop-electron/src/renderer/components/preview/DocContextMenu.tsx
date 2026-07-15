// Right-click context menu for documents in ANY view (table/kanban/calendar):
// consistent action list = defaults (Open, Peek, Duplicate, Delete, Versions)
// + the collection's custom editActions from the payload config, all through
// the desktop ActionRegistry. Positioned at the cursor, dismisses on Esc /
// outside click / action.
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { useLocalDB, useLocalMutations } from '@payload-universal/local-db'
import type { AdminSchema } from '@payload-universal/admin-schema'
import { resolveHandler } from '../../lib/actions'
import { useToast } from '../toast/ToastProvider'
import { useDocPeek } from './DocPeek'

type MenuTarget = { slug: string; docId: string; x: number; y: number }

type MenuApi = {
  openDocMenu: (slug: string, docId: string, x: number, y: number) => void
}

const MenuContext = createContext<MenuApi>({ openDocMenu: () => {} })
export const useDocMenu = () => useContext(MenuContext)

/** Clone semantics shared with DocumentForm's Duplicate. */
function cloneValues(doc: Record<string, unknown>, hasDrafts: boolean): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(doc)) {
    if (['id', 'createdAt', 'updatedAt'].includes(k) || k.startsWith('_')) continue
    out[k] = v
  }
  for (const key of ['title', 'name']) {
    if (typeof out[key] === 'string') {
      out[key] = `${out[key]} (Copy)`
      break
    }
  }
  if (hasDrafts) out._status = 'draft'
  return out
}

export function DocContextMenuProvider({
  children,
  schema,
  serverURL,
  onOpenEditor,
}: {
  children: React.ReactNode
  schema: AdminSchema
  serverURL: string
  onOpenEditor: (slug: string, docId: string) => void
}) {
  const [target, setTarget] = useState<MenuTarget | null>(null)
  const openDocMenu = useCallback(
    (slug: string, docId: string, x: number, y: number) => setTarget({ slug, docId, x, y }),
    [],
  )
  const close = useCallback(() => setTarget(null), [])

  useEffect(() => {
    if (!target) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    const onDown = () => close()
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onDown)
    }
  }, [target, close])

  return (
    <MenuContext.Provider value={{ openDocMenu }}>
      {children}
      {target && (
        <MenuBody
          target={target}
          schema={schema}
          serverURL={serverURL}
          onOpenEditor={onOpenEditor}
          onClose={close}
        />
      )}
    </MenuContext.Provider>
  )
}

function MenuBody({
  target,
  schema,
  serverURL,
  onOpenEditor,
  onClose,
}: {
  target: MenuTarget
  schema: AdminSchema
  serverURL: string
  onOpenEditor: (slug: string, docId: string) => void
  onClose: () => void
}) {
  const localDB = useLocalDB()
  const { create, update, remove } = useLocalMutations(localDB, target.slug)
  const { showToast } = useToast()
  const { openPeek } = useDocPeek()

  const meta = schema.menuModel.collections.find((c) => c.slug === target.slug)
  const editActions = meta?.editActions ?? []
  const hasDrafts = Boolean(meta?.drafts)

  const getDoc = async (): Promise<Record<string, unknown> | null> => {
    const col = localDB?.collections[target.slug]
    if (!col) return null
    const rx = await col.findOne(target.docId).exec()
    return rx ? (rx.toJSON() as Record<string, unknown>) : null
  }

  const run = async (fn: () => Promise<void>) => {
    try {
      await fn()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Action failed', { type: 'error' })
    }
    onClose()
  }

  const items: Array<{ label: string; danger?: boolean; onSelect: () => void }> = [
    { label: 'Open', onSelect: () => void run(async () => onOpenEditor(target.slug, target.docId)) },
    { label: 'Peek', onSelect: () => void run(async () => openPeek(target.slug, target.docId)) },
    {
      label: 'Duplicate',
      onSelect: () =>
        void run(async () => {
          const source = await getDoc()
          if (!source) throw new Error('Document not found locally')
          const id = await create(cloneValues(source, hasDrafts))
          onOpenEditor(target.slug, id)
          showToast('Duplicated', { type: 'success' })
        }),
    },
    ...(hasDrafts
      ? [{ label: 'Versions', onSelect: () => void run(async () => onOpenEditor(target.slug, target.docId)) }]
      : []),
    ...editActions
      .filter((a) => {
        // Config actions that duplicate a built-in (e.g. duplicatePost) are
        // dropped — one consistent list, no double entries.
        const label = (a.label ?? a.key).toLowerCase()
        return !['duplicate', 'delete', 'open', 'peek', 'versions'].includes(label) && a.key !== 'duplicatePost'
      })
      .map((a) => ({
      label: a.label ?? a.key,
      danger: Boolean((a as { destructive?: boolean }).destructive),
      onSelect: () =>
        void run(async () => {
          const handler = resolveHandler(target.slug, 'edit', a.key)
          if (!handler) {
            showToast('Handler not registered.', { type: 'error' })
            return
          }
          const source = await getDoc()
          if (!source) throw new Error('Document not found locally')
          if ((a as { destructive?: boolean }).destructive && !window.confirm(`${a.label ?? a.key}?`)) return
          await handler({
            slug: target.slug,
            docs: [source],
            update: async (id, data) => void (await update(id, data)),
            remove: async (id) => void (await remove(id)),
            serverURL,
            toast: showToast,
          })
        }),
    })),
    {
      label: 'Delete',
      danger: true,
      onSelect: () =>
        void run(async () => {
          if (!window.confirm('Delete this document?')) return
          await remove(target.docId)
          showToast('Deleted', { type: 'success' })
        }),
    },
  ]

  // Keep the menu on-screen.
  const style: React.CSSProperties = {
    left: Math.min(target.x, window.innerWidth - 240),
    top: Math.min(target.y, window.innerHeight - items.length * 34 - 16),
  }

  return (
    <div className="doc-context-menu picker-menu" style={style} onMouseDown={(e) => e.stopPropagation()}>
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          className={`option${item.danger ? ' danger' : ''}`}
          onClick={item.onSelect}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
