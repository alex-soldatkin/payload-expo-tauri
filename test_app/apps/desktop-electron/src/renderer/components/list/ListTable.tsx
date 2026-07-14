// The grid table: sticky header with click-to-sort, one row per doc. The first
// cell of every row carries the locally-modified dot marker.
import { renderCell } from './cells'
import type { DisplayField } from './columns'

type Props = {
  columns: DisplayField[]
  docs: Record<string, unknown>[]
  sortField: string | null
  sortDir: 'asc' | 'desc'
  onSort: (key: string) => void
  onOpen: (id: string) => void
}

export function ListTable({ columns, docs, sortField, sortDir, onSort, onOpen }: Props) {
  const gridTemplate = `18px ${columns.map(() => 'minmax(120px, 1fr)').join(' ')}`

  return (
    <div className="list-table" style={{ gridTemplateColumns: gridTemplate }}>
      <div className="list-head-cell" />
      {columns.map((col) => {
        const isSorted = sortField === col.key
        return (
          <button
            key={col.key}
            type="button"
            className={`list-head-cell${col.sortable ? ' sortable' : ''}`}
            onClick={col.sortable ? () => onSort(col.key) : undefined}
            disabled={!col.sortable}
          >
            <span className="list-head-label">{col.label}</span>
            {isSorted && (
              <span className="sort-indicator">{sortDir === 'asc' ? '▲' : '▼'}</span>
            )}
          </button>
        )
      })}

      {docs.map((doc) => {
        const id = String(doc.id ?? '')
        const modified = Boolean(doc._locallyModified)
        return (
          <div
            key={id}
            className="list-row"
            role="button"
            tabIndex={0}
            onClick={() => onOpen(id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onOpen(id)
              }
            }}
          >
            <span className="list-row-marker">
              <span className={`dot${modified ? '' : ' placeholder'}`} />
            </span>
            {columns.map((col, i) => (
              <span
                key={col.key}
                className={`list-cell${i === 0 ? ' title' : ''}`}
                title={typeof doc[col.key] === 'string' ? (doc[col.key] as string) : undefined}
              >
                {renderCell(col, doc)}
              </span>
            ))}
          </div>
        )
      })}
    </div>
  )
}
