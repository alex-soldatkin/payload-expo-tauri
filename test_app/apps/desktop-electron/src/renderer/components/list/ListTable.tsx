import { longPressHandlers } from '../../lib/longPress'
// The grid table: sticky header with click-to-sort, one row per doc. A leading
// checkbox column drives row selection (header checkbox = select-all-on-page);
// the second cell of every row carries the locally-modified dot marker.
import { renderCell } from './cells'
import type { DisplayField } from './columns'

type Props = {
  columns: DisplayField[]
  docs: Record<string, unknown>[]
  sortField: string | null
  sortDir: 'asc' | 'desc'
  onSort: (key: string) => void
  onOpen: (id: string) => void
  onPeek?: (id: string) => void
  onDocMenu?: (id: string, x: number, y: number) => void
  /** Selected doc ids; presence enables the checkbox column. */
  selectedIds: Set<string>
  onToggleOne: (id: string) => void
  /** Select/clear every doc on the current page. */
  onToggleAll: (checked: boolean) => void
}

export function ListTable({
  columns,
  docs,
  sortField,
  sortDir,
  onSort,
  onOpen,
  onPeek,
  onDocMenu,
  selectedIds,
  onToggleOne,
  onToggleAll,
}: Props) {
  const gridTemplate = `32px 18px ${columns.map(() => 'minmax(120px, 1fr)').join(' ')}`
  const allSelected = docs.length > 0 && docs.every((d) => selectedIds.has(String(d.id ?? '')))

  return (
    <div className="list-table" style={{ gridTemplateColumns: gridTemplate }}>
      <div className="list-head-cell list-select-cell">
        <input
          type="checkbox"
          aria-label="Select all on page"
          checked={allSelected}
          onChange={(e) => onToggleAll(e.target.checked)}
        />
      </div>
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
        const selected = selectedIds.has(id)
        return (
          <div
            key={id}
            className={`list-row${selected ? ' selected' : ''}`}
            role="button"
            tabIndex={0}
            {...(onPeek ? longPressHandlers(() => onPeek(id)) : {})}
            onContextMenu={(e) => {
              if (!onDocMenu) return
              e.preventDefault()
              onDocMenu(id, e.clientX, e.clientY)
            }}
            onClick={(e) => (e.metaKey || e.ctrlKey ? onOpen(id) : onToggleOne(id))}
            onDoubleClick={() => onOpen(id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                onOpen(id)
              } else if (e.key === ' ') {
                e.preventDefault()
                onToggleOne(id)
              }
            }}
          >
            <span
              className="list-select-cell"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <input
                type="checkbox"
                aria-label="Select row"
                checked={selected}
                onChange={() => onToggleOne(id)}
              />
            </span>
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
