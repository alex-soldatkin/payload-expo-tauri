// Extra field lines on board cards / calendar chips / gantt bars, driven by
// the SAME per-collection column config as the table (gear icon → select +
// reorder). Values format exactly like table cells (renderCell — badges,
// dates, relationship labels); empty values are skipped so cards stay tight.
import type { ReactNode } from 'react'
import type { DisplayField } from './columns'
import { renderCell } from './cells'

function isEmpty(node: ReactNode): boolean {
  return node == null || node === '' || node === '—'
}

export function CardFields({
  doc,
  cols,
  inline = false,
}: {
  doc: Record<string, unknown>
  cols: DisplayField[]
  /** Single-line variant (gantt bar labels) — values only, dot-separated. */
  inline?: boolean
}) {
  const items = cols
    .map((col) => ({ col, node: renderCell(col, doc) }))
    .filter((i) => !isEmpty(i.node))
  if (items.length === 0) return null

  if (inline) {
    return (
      <span className="card-fields inline">
        {items.map((i) => (
          <span key={i.col.key} className="card-field-value">
            {i.node}
          </span>
        ))}
      </span>
    )
  }
  return (
    <div className="card-fields">
      {items.map((i) => (
        <span key={i.col.key} className="card-field">
          <span className="card-field-label">{i.col.label}</span>
          <span className="card-field-value">{i.node}</span>
        </span>
      ))}
    </div>
  )
}

/** The configured columns worth repeating on a card — everything except the
 *  title (already the card headline) and fields the view itself visualizes. */
export function cardFieldCols(displayCols: DisplayField[], exclude: Array<string | undefined>): DisplayField[] {
  const skip = new Set(exclude.filter(Boolean) as string[])
  return displayCols.filter((c) => !skip.has(c.key))
}
