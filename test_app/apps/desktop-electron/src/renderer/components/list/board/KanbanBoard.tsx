// Property-driven Kanban board (issue #25 slice one). Columns are derived from
// the chosen select/radio field's options — a leading 'No value' column for
// docs missing (or holding an unknown) value, then one column per option. The
// docs are the SAME filtered `visible` array the table renders; no fetching
// here. Dragging a card into a different column writes that field via the
// local-first mutation (undefined for the 'No value' column).
import { useMemo, useRef, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { useLocalDB, useLocalMutations } from '@payload-universal/local-db'
import type { SchemaField } from '../../../form/types'
import { optionValue, resolveOptionLabel } from '../../../form/labels'
import { KanbanColumn, NO_VALUE } from './KanbanColumn'
import { KanbanCardBody } from './KanbanCard'
import type { DisplayField } from '../columns'

type Props = {
  slug: string
  field: SchemaField
  docs: Record<string, unknown>[]
  useAsTitle?: string
  onOpen: (id: string) => void
  onPeek?: (id: string) => void
  onDocMenu?: (id: string, x: number, y: number) => void
  selectedIds?: Set<string>
  onToggleSelect?: (id: string) => void
  /** Configured extra columns (gear icon flow) repeated on each card. */
  cardCols?: DisplayField[]
}

type Column = { value: string | null; label: string }

export function KanbanBoard({ slug, field, docs, useAsTitle, onOpen, onPeek, onDocMenu, selectedIds, onToggleSelect, cardCols }: Props) {
  const localDB = useLocalDB()
  const { update } = useLocalMutations(localDB, slug)
  const fieldName = field.name ?? ''

  // A leading 'No value' column, then one column per option (in option order).
  const columns = useMemo<Column[]>(() => {
    const opts = field.options ?? []
    return [
      { value: null, label: 'No value' },
      ...opts.map((opt) => ({ value: optionValue(opt), label: resolveOptionLabel(opt) })),
    ]
  }, [field.options])

  // Bucket the visible docs by their current field value; unknown/empty values
  // fall into the 'No value' column.
  const grouped = useMemo(() => {
    const known = new Set(columns.map((c) => c.value).filter((v): v is string => v != null))
    const byValue = new Map<string | null, Record<string, unknown>[]>()
    for (const c of columns) byValue.set(c.value, [])
    for (const doc of docs) {
      const raw = doc[fieldName]
      const key = typeof raw === 'string' && known.has(raw) ? raw : null
      byValue.get(key)!.push(doc)
    }
    return byValue
  }, [columns, docs, fieldName])

  const sensors = useSensors(
    // 6px activation so a plain click still opens the card (drag needs intent).
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  )

  // The docs under drag — rendered as a DragOverlay so the moving preview
  // escapes the column's overflow clipping (in-column cards stay dimmed).
  // Dragging a card that is part of the current multi-selection carries the
  // WHOLE selection: source cards 'gather' (shrink/fade), the overlay shows a
  // stacked deck with a count, and the drop moves every carried card.
  const [dragIds, setDragIds] = useState<string[]>([])
  const dragDocs = useMemo(
    () => dragIds.map((id) => docs.find((d) => String(d.id ?? '') === id)).filter(Boolean) as Record<string, unknown>[],
    [dragIds, docs],
  )
  // Ids that just landed in a new column — briefly animated into place.
  const [placedIds, setPlacedIds] = useState<Set<string>>(new Set())
  const placedTimer = useRef<number | null>(null)
  // Browsers fire a click on the source card after a completed drag; cards
  // check-and-clear this so a drop doesn't also toggle selection.
  const suppressClickRef = useRef(false)

  const onDragStart = (e: DragStartEvent) => {
    const id = String(e.active.id)
    setDragIds(selectedIds?.has(id) && selectedIds.size > 1 ? [...selectedIds] : [id])
  }

  const onDragEnd = (e: DragEndEvent) => {
    const carried = dragIds
    setDragIds([])
    suppressClickRef.current = true
    const { over } = e
    if (!over) return
    const overId = String(over.id)
    if (!overId.startsWith('col:')) return
    const raw = overId.slice('col:'.length)
    const target = raw === NO_VALUE ? null : raw
    const moved: string[] = []
    for (const id of carried) {
      const doc = docs.find((d) => String(d.id ?? '') === id)
      if (!doc) continue
      const current = typeof doc[fieldName] === 'string' ? (doc[fieldName] as string) : null
      if (current === target) continue // already in the target column — no-op
      moved.push(id)
      // 'No value' clears the field; otherwise set the option value.
      void update(id, { [fieldName]: target ?? undefined }).catch((err) => {
        console.error('Failed to move card:', err)
      })
    }
    if (moved.length > 0) {
      setPlacedIds(new Set(moved))
      if (placedTimer.current !== null) window.clearTimeout(placedTimer.current)
      placedTimer.current = window.setTimeout(() => setPlacedIds(new Set()), 450)
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDragIds([])}
    >
      <div className="board">
        {columns.map((col) => (
          <KanbanColumn
            key={col.value ?? NO_VALUE}
            value={col.value}
            label={col.label}
            docs={grouped.get(col.value) ?? []}
            useAsTitle={useAsTitle}
            onOpen={onOpen}
            onPeek={onPeek}
            onDocMenu={onDocMenu}
            selectedIds={selectedIds}
            onToggleSelect={onToggleSelect}
            suppressClickRef={suppressClickRef}
            draggingIds={dragIds}
            placedIds={placedIds}
            cardCols={cardCols}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={null}>
        {dragDocs.length > 0 ? (
          <div className="board-card-stack">
            {/* Up to three cards fan out beneath the front one; a count pill
                tops the deck when more are carried than shown. */}
            {dragDocs.slice(0, 3).map((doc, i) => (
              <div
                key={String(doc.id ?? i)}
                className={`board-card overlay stacked-${i}`}
              >
                <KanbanCardBody doc={doc} useAsTitle={useAsTitle} cardCols={cardCols} />
              </div>
            ))}
            {dragDocs.length > 1 && (
              <span className="board-stack-count">{dragDocs.length}</span>
            )}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
