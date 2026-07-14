// The row above the table: search, column-config gear, page-size, refresh, and
// the "New document" button. Keyboard shortcuts (Cmd/Ctrl+F focus search,
// Cmd/Ctrl+R refetch) are wired here with window listeners cleaned up on unmount.
import { useEffect, useRef, useState } from 'react'
import type { DisplayField } from './columns'
import { ColumnConfig } from './ColumnConfig'

const PAGE_SIZES = [25, 50, 100]

type Props = {
  search: string
  onSearch: (v: string) => void
  displayable: DisplayField[]
  columns: string[]
  titleKey: string
  onToggleColumn: (key: string) => void
  onMoveColumn: (key: string, dir: -1 | 1) => void
  onResetColumns: () => void
  pageSize: number
  onPageSize: (n: number) => void
  onRefresh: () => void
  onCreate: () => void
  canCreate: boolean
}

export function ListToolbar({
  search,
  onSearch,
  displayable,
  columns,
  titleKey,
  onToggleColumn,
  onMoveColumn,
  onResetColumns,
  pageSize,
  onPageSize,
  onRefresh,
  onCreate,
  canCreate,
}: Props) {
  const [configOpen, setConfigOpen] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault()
        searchRef.current?.focus()
        searchRef.current?.select()
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault()
        onRefresh()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onRefresh])

  return (
    <div className="list-toolbar">
      <input
        ref={searchRef}
        className="list-search"
        type="text"
        placeholder="Search…"
        value={search}
        onChange={(e) => onSearch(e.target.value)}
      />
      <div className="spacer" />
      <div className="list-config-wrap">
        <button
          className="icon-btn"
          onClick={() => setConfigOpen((o) => !o)}
          title="Configure columns"
          aria-label="Configure columns"
        >
          ⚙
        </button>
        {configOpen && (
          <ColumnConfig
            displayable={displayable}
            columns={columns}
            titleKey={titleKey}
            onToggle={onToggleColumn}
            onMove={onMoveColumn}
            onReset={onResetColumns}
            onClose={() => setConfigOpen(false)}
          />
        )}
      </div>
      <select
        value={pageSize}
        onChange={(e) => onPageSize(Number(e.target.value))}
        title="Rows per page"
      >
        {PAGE_SIZES.map((n) => (
          <option key={n} value={n}>
            {n} / page
          </option>
        ))}
      </select>
      <button className="icon-btn" onClick={onRefresh} title="Refresh" aria-label="Refresh">
        ↻
      </button>
      <button className="primary" onClick={onCreate} disabled={!canCreate}>
        New document
      </button>
    </div>
  )
}
