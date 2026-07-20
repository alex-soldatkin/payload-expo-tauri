// Join editor: READ-ONLY list of related docs. `field.collection` is the target
// slug; `field.on` is the field on the target that points back at THIS doc.
// Combines a direct Mango selector with a client-side scan of a broader list so
// we match whether the stored relationship is an id string or an object.
import { useMemo } from 'react'
import { useLocalCollection, useLocalDB, useLocalQuery } from '@payload-universal/local-db'
import type { PayloadDoc } from '@payload-universal/local-db'
import type { FieldComponentProps } from '../types'
import { useFormEngine } from '../FieldRenderer'
import { FieldShell } from './shared'
import { docTitle, formatUpdatedAt } from '../../lib/doc'
import { longPressHandlers } from '../../lib/longPress'
import { useDocPeek } from '../../components/preview/DocPeek'
import { getShimNavSink } from '../ui-shim/scopes'

const CAP = 20

/** Resolve the id a related row's `on` field points at (string or object). */
function pointsAt(row: PayloadDoc, on: string): string {
  const v = row[on]
  if (v && typeof v === 'object') {
    const o = v as { id?: unknown; value?: unknown }
    return String(o.id ?? o.value ?? '')
  }
  return String(v ?? '')
}

export function JoinField(props: FieldComponentProps) {
  const { field } = props
  const { docId } = useFormEngine()
  const localDB = useLocalDB()
  const { openPeek } = useDocPeek()

  const target = field.collection ?? ''
  const on = field.on ?? ''

  // Direct selector — fast path when the value is stored as a plain id.
  const { docs: direct } = useLocalQuery(localDB, target, {
    selector: { [on]: docId },
  })
  // Broader scan — catches object-shaped stored values via client-side match.
  const { docs: scanned } = useLocalCollection(localDB, target, { limit: 200 })

  const related = useMemo(() => {
    const byId = new Map<string, PayloadDoc>()
    for (const row of direct) {
      if (row._deleted) continue
      byId.set(row.id, row)
    }
    for (const row of scanned) {
      if (row._deleted) continue
      if (pointsAt(row, on) === docId) byId.set(row.id, row)
    }
    return Array.from(byId.values())
  }, [direct, scanned, on, docId])

  const shown = related.slice(0, CAP)
  const overflow = related.length - shown.length

  return (
    <FieldShell props={props}>
      {related.length === 0 ? (
        <div className="doc-meta">No related documents.</div>
      ) : (
        <div className="field-rows">
          {shown.map((row) => (
            // Join rows navigate like list rows: double-click (or Cmd/Ctrl+
            // click) opens the related doc's editor tab, long-press peeks.
            <div
              key={row.id}
              className="doc-row join-row"
              style={{ padding: '8px 10px' }}
              role="button"
              tabIndex={0}
              {...longPressHandlers(() => openPeek(target, row.id))}
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey) getShimNavSink()?.openEditor(target, row.id)
              }}
              onDoubleClick={() => getShimNavSink()?.openEditor(target, row.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  getShimNavSink()?.openEditor(target, row.id)
                }
              }}
            >
              <span className="title">{docTitle(row)}</span>
              <span className="meta">{formatUpdatedAt(row.updatedAt)}</span>
            </div>
          ))}
          {overflow > 0 && <div className="doc-meta">+{overflow} more</div>}
        </div>
      )}
    </FieldShell>
  )
}
