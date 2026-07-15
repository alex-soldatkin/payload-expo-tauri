// Property-driven month calendar (issue #25 slice two). The month is derived
// from the chosen top-level date field: the SAME filtered `docs` array the
// table renders is bucketed by each doc's local day for that field — no
// fetching here. Docs missing the field are simply not placed (a header count
// reports how many are undated). Month navigation is component-only state; the
// chosen field is persisted by the parent (mirrors the board's field picker).
//
// Chips are draggable between day cells to reschedule (dnd-kit, mirroring the
// kanban board): useDraggable chips + useDroppable day cells + a DragOverlay so
// the moving chip escapes the day cell's overflow clip. A drop rewrites the
// calendar date field to the target day, PRESERVING the original time-of-day.
import { useMemo, useRef, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { longPressHandlers } from '../../../lib/longPress'
import { docTitle } from '../../../lib/doc'
import { CardFields } from '../CardFields'
import type { DisplayField } from '../columns'
import {
  cursorFromKey,
  monthGrid,
  monthLabel,
  stepMonth,
  todayKey,
  valueDayKey,
  weekdayLabels,
  type MonthCursor,
} from './monthGrid'

/** Max doc chips rendered per day cell before an overflow row (mobile parity). */
const MAX_CELL_CHIPS = 3

/** Prefix for droppable day-cell ids so they don't collide with draggable chips. */
const DAY_PREFIX = 'day:'

/**
 * Move a raw date value onto the target LOCAL day `YYYY-MM-DD`, preserving the
 * original value's time-of-day (and its literal day-only form when stored as
 * 'YYYY-MM-DD'). Returns an ISO string / day-only string, or null when the
 * source value is unparseable.
 */
function moveValueToDay(value: unknown, dayKey: string): string | null {
  const [ty, tm, td] = dayKey.split('-').map(Number)
  if (!ty || !tm || !td) return null

  if (typeof value === 'string') {
    const s = value.trim()
    // Day-only storage: keep the day-only shape, just swap in the target day.
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return dayKey
  }
  // Instant storage: keep the original local time-of-day, swap the Y-M-D.
  const asDate =
    value instanceof Date
      ? value
      : typeof value === 'number' || typeof value === 'string'
        ? new Date(value)
        : null
  if (!asDate || Number.isNaN(asDate.getTime())) return null
  const next = new Date(
    ty,
    tm - 1,
    td,
    asDate.getHours(),
    asDate.getMinutes(),
    asDate.getSeconds(),
    asDate.getMilliseconds(),
  )
  return next.toISOString()
}

type Props = {
  fieldName: string
  docs: Record<string, unknown>[]
  useAsTitle?: string
  onOpen: (id: string) => void
  onPeek?: (id: string) => void
  onDocMenu?: (id: string, x: number, y: number) => void
  selectedIds?: Set<string>
  onToggleSelect?: (id: string) => void
  /** Local-first mutation to persist a dragged chip's new day. */
  update?: (id: string, patch: Record<string, unknown>) => Promise<unknown>
  /** Configured extra columns (gear icon flow) shown under chip titles. */
  cardCols?: DisplayField[]
}

/** The chip's visual content, shared with the DragOverlay preview. */
function ChipBody({
  doc,
  useAsTitle,
  cardCols,
}: {
  doc: Record<string, unknown>
  useAsTitle?: string
  cardCols?: DisplayField[]
}) {
  return (
    <>
      <span className="cal-chip-title">{docTitle(doc, useAsTitle)}</span>
      {cardCols && cardCols.length > 0 && <CardFields doc={doc} cols={cardCols} />}
    </>
  )
}

/** A draggable doc chip in a day cell. Pointer handlers merge long-press peek
 *  with dnd-kit's activator (spreading one after the other would overwrite
 *  onPointerDown and kill dragging — see KanbanCard). */
function CalendarChip({
  doc,
  useAsTitle,
  cardCols,
  onOpen,
  onPeek,
  onDocMenu,
  selected,
  onToggleSelect,
  draggable,
  suppressClickRef,
}: {
  doc: Record<string, unknown>
  useAsTitle?: string
  cardCols?: DisplayField[]
  onOpen: (id: string) => void
  onPeek?: (id: string) => void
  onDocMenu?: (id: string, x: number, y: number) => void
  selected?: boolean
  onToggleSelect?: (id: string) => void
  draggable: boolean
  suppressClickRef: React.MutableRefObject<boolean>
}) {
  const id = String(doc.id ?? '')
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id, disabled: !draggable })
  const lp = onPeek ? longPressHandlers(() => onPeek(id)) : null

  return (
    <div
      ref={setNodeRef}
      className={`cal-chip${selected ? ' selected' : ''}${isDragging ? ' dragging' : ''}`}
      title={docTitle(doc, useAsTitle)}
      {...attributes}
      role="button"
      tabIndex={0}
      onPointerDown={(e) => {
        lp?.onPointerDown(e)
        ;(listeners?.onPointerDown as ((e: React.PointerEvent) => void) | undefined)?.(e)
      }}
      onPointerMove={(e) => lp?.onPointerMove(e)}
      onPointerUp={() => lp?.onPointerUp()}
      onPointerLeave={() => lp?.onPointerLeave()}
      onClickCapture={(e) => lp?.onClickCapture(e)}
      onContextMenu={(e) => {
        if (!onDocMenu) return
        e.preventDefault()
        onDocMenu(id, e.clientX, e.clientY)
      }}
      onClick={(e) => {
        if (suppressClickRef.current) {
          suppressClickRef.current = false
          return
        }
        // Cmd/Ctrl+click: open in a tab, leave selection alone.
        if (e.metaKey || e.ctrlKey) return onOpen(id)
        if (onToggleSelect) onToggleSelect(id)
        else onOpen(id)
      }}
      onDoubleClick={() => onOpen(id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen(id)
        }
      }}
    >
      <ChipBody doc={doc} useAsTitle={useAsTitle} cardCols={cardCols} />
    </div>
  )
}

/** A droppable day cell — tints while a chip is dragged over it (like .board-col.over). */
function DayCell({
  cellKey,
  droppable,
  className,
  children,
}: {
  cellKey: string
  droppable: boolean
  className: string
  children: React.ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id: DAY_PREFIX + cellKey, disabled: !droppable })
  return (
    <div ref={setNodeRef} className={className + (isOver ? ' over' : '')}>
      {children}
    </div>
  )
}

export function CalendarView({ fieldName, docs, useAsTitle, onOpen, onPeek, onDocMenu, selectedIds, onToggleSelect, update, cardCols }: Props) {
  const [cursor, setCursor] = useState<MonthCursor>(() => cursorFromKey(todayKey()))

  // Bucket docs by their local day key for the chosen field; count undated.
  const { byDay, undated } = useMemo(() => {
    const map = new Map<string, Record<string, unknown>[]>()
    let missing = 0
    for (const doc of docs) {
      const key = valueDayKey(doc[fieldName])
      if (!key) {
        missing++
        continue
      }
      const bucket = map.get(key)
      if (bucket) bucket.push(doc)
      else map.set(key, [doc])
    }
    return { byDay: map, undated: missing }
  }, [docs, fieldName])

  const cells = useMemo(() => monthGrid(cursor), [cursor])
  const weekdays = useMemo(() => weekdayLabels(), [])
  const today = todayKey()

  const draggable = Boolean(update)
  const sensors = useSensors(
    // 6px activation so a plain click still selects/opens (drag needs intent).
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  )
  // The doc under drag — rendered as a DragOverlay so the moving preview
  // escapes the day cell's overflow clip (the in-cell chip stays dimmed).
  const [dragId, setDragId] = useState<string | null>(null)
  const dragDoc = useMemo(
    () => (dragId ? docs.find((d) => String(d.id ?? '') === dragId) ?? null : null),
    [dragId, docs],
  )
  // Browsers fire a click on the source chip after a completed drag; the chip
  // checks-and-clears this so a drop doesn't also toggle selection.
  const suppressClickRef = useRef(false)

  const onDragStart = (e: DragStartEvent) => setDragId(String(e.active.id))

  const onDragEnd = (e: DragEndEvent) => {
    const id = dragId
    setDragId(null)
    suppressClickRef.current = true
    if (!id || !update) return
    const { over } = e
    if (!over) return
    const overId = String(over.id)
    if (!overId.startsWith(DAY_PREFIX)) return
    const targetKey = overId.slice(DAY_PREFIX.length)
    const doc = docs.find((d) => String(d.id ?? '') === id)
    if (!doc) return
    if (valueDayKey(doc[fieldName]) === targetKey) return // already on that day — no-op
    const next = moveValueToDay(doc[fieldName], targetKey)
    if (next == null) return
    void update(id, { [fieldName]: next }).catch((err) => {
      console.error('Failed to reschedule:', err)
    })
  }

  const grid = (
    <div className="cal-grid">
      {weekdays.map((w) => (
        <div key={w} className="cal-weekday">
          {w}
        </div>
      ))}
      {cells.map((cell) => {
        const dayDocs = byDay.get(cell.key) ?? []
        const overflow = dayDocs.length - MAX_CELL_CHIPS
        const className =
          'cal-cell' +
          (cell.inMonth ? '' : ' out') +
          (cell.key === today ? ' today' : '') +
          (dayDocs.length > MAX_CELL_CHIPS ? ' dense' : '')
        return (
          <DayCell key={cell.key} cellKey={cell.key} droppable={draggable} className={className}>
            <span className="cal-daynum">{cell.day}</span>
            {dayDocs.slice(0, MAX_CELL_CHIPS).map((doc) => (
              <CalendarChip
                key={String(doc.id ?? '')}
                doc={doc}
                useAsTitle={useAsTitle}
                cardCols={cardCols}
                onOpen={onOpen}
                onPeek={onPeek}
                onDocMenu={onDocMenu}
                selected={selectedIds?.has(String(doc.id ?? ''))}
                onToggleSelect={onToggleSelect}
                draggable={draggable}
                suppressClickRef={suppressClickRef}
              />
            ))}
            {overflow > 0 && <span className="cal-overflow">+{overflow} more</span>}
          </DayCell>
        )
      })}
    </div>
  )

  return (
    <div className="calendar">
      <div className="cal-head">
        <span className="cal-month">{monthLabel(cursor)}</span>
        <div className="cal-nav">
          <button type="button" onClick={() => setCursor((c) => stepMonth(c, -1))}>
            ‹
          </button>
          <button type="button" onClick={() => setCursor(cursorFromKey(todayKey()))}>
            Today
          </button>
          <button type="button" onClick={() => setCursor((c) => stepMonth(c, 1))}>
            ›
          </button>
        </div>
        {undated > 0 && (
          <span className="cal-undated">
            {undated} undated
          </span>
        )}
      </div>

      {draggable ? (
        <DndContext
          sensors={sensors}
          collisionDetection={pointerWithin}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragCancel={() => setDragId(null)}
        >
          {grid}
          <DragOverlay dropAnimation={null}>
            {dragDoc ? (
              <div className="cal-chip overlay">
                <ChipBody doc={dragDoc} useAsTitle={useAsTitle} cardCols={cardCols} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : (
        grid
      )}
    </div>
  )
}
