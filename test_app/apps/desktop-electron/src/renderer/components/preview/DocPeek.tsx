// Long-press document peek (desktop twin of mobile's ScrollablePreview):
// a dismissable floating card with a read-only field summary of the doc,
// live from the local DB. Esc / backdrop click dismisses; Open jumps to the
// full editor tab.
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { useLocalDB, useLocalDocument } from '@payload-universal/local-db'
import { docTitle, formatUpdatedAt } from '../../lib/doc'
import { formatValue } from '../../form/versions/diff'

type PeekTarget = { slug: string; docId: string }

type PeekApi = {
  openPeek: (slug: string, docId: string) => void
}

const PeekContext = createContext<PeekApi>({ openPeek: () => {} })
export const useDocPeek = () => useContext(PeekContext)

export function DocPeekProvider({
  children,
  onOpenEditor,
}: {
  children: React.ReactNode
  onOpenEditor: (slug: string, docId: string) => void
}) {
  const [target, setTarget] = useState<PeekTarget | null>(null)
  const openPeek = useCallback((slug: string, docId: string) => setTarget({ slug, docId }), [])
  const close = useCallback(() => setTarget(null), [])

  useEffect(() => {
    if (!target) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [target, close])

  return (
    <PeekContext.Provider value={{ openPeek }}>
      {children}
      {target && (
        <div className="peek-overlay" onMouseDown={close}>
          <div className="peek-card" onMouseDown={(e) => e.stopPropagation()}>
            <PeekBody
              target={target}
              onOpen={() => {
                onOpenEditor(target.slug, target.docId)
                close()
              }}
              onClose={close}
            />
          </div>
        </div>
      )}
    </PeekContext.Provider>
  )
}

/** Keys hidden from the peek summary. */
const SKIP = new Set(['id', 'createdAt'])

function PeekBody({
  target,
  onOpen,
  onClose,
}: {
  target: PeekTarget
  onOpen: () => void
  onClose: () => void
}) {
  const localDB = useLocalDB()
  const { doc, loading } = useLocalDocument(localDB, target.slug, target.docId)
  const record = (doc ?? {}) as Record<string, unknown>

  const entries = Object.entries(record).filter(
    ([k, v]) => !SKIP.has(k) && !k.startsWith('_') && v != null && v !== '',
  )

  return (
    <>
      <div className="peek-head">
        <span className="peek-title">{doc ? docTitle(record) : 'Loading…'}</span>
        <span className="doc-meta">{doc ? formatUpdatedAt(record.updatedAt) : ''}</span>
        <div className="spacer" />
        <button className="primary" onClick={onOpen}>Open</button>
        <button onClick={onClose} aria-label="Dismiss">×</button>
      </div>
      <div className="peek-body">
        {loading && !doc && <div className="empty">Loading…</div>}
        {doc &&
          entries.map(([k, v]) => (
            <div key={k} className="peek-row">
              <span className="peek-key">{k}</span>
              <span className="peek-value">{formatValue(v)}</span>
            </div>
          ))}
        {doc && entries.length === 0 && <div className="empty">No content.</div>}
      </div>
    </>
  )
}
