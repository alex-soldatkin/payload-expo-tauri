// Property-driven gantt view (issue #25 slice three). Two chosen top-level date
// fields form each doc's bar: start → end. The docs are the SAME filtered array
// the table renders — no fetching here. A left fixed column lists doc titles; the
// right pane scrolls horizontally over a time axis (min start → max end, padded a
// week; see timeScale.ts). Docs missing either date fall into an "Unscheduled"
// section as title-only rows. Row/bar interactions mirror the calendar/board:
// single-click toggles selection, double-click opens, long-press peeks, right-click
// opens the doc menu. Dragging a bar horizontally shifts BOTH dates by the dragged
// whole-day delta (preserving each value's time-of-day) and writes on pointerup via
// `update`; drags under half a day are ignored. Plain pointer events + setPointer
// capture are used (not dnd-kit), since kanban's column-drop model doesn't fit a
// continuous horizontal axis.
import { useEffect, useMemo, useRef, useState } from 'react'
import { longPressHandlers } from '../../../lib/longPress'
import { docTitle } from '../../../lib/doc'
import { CardFields } from '../CardFields'
import type { DisplayField } from '../columns'
import {
  DAY_WIDTH,
  addDays,
  computeDomain,
  dayToX,
  daysBetween,
  monthTicks,
  todayX,
  valueToDay,
  weekTicks,
} from './timeScale'

/** Fixed row height so the left title column and right bars stay aligned. */
const ROW_H = 30
/** Width of the left title column in px. */
const LABEL_W = 200

type Props = {
  startField: string
  endField: string
  docs: Record<string, unknown>[]
  useAsTitle?: string
  onOpen: (id: string) => void
  onPeek?: (id: string) => void
  onDocMenu?: (id: string, x: number, y: number) => void
  selectedIds?: Set<string>
  onToggleSelect?: (id: string) => void
  /** Local-first mutation to persist a dragged bar's new start/end dates. */
  update: (id: string, patch: Record<string, unknown>) => Promise<unknown>
  /** Configured extra columns (gear icon flow) shown after bar titles. */
  cardCols?: DisplayField[]
}

/**
 * Shift a raw date value by N whole days, preserving its original time-of-day
 * (and its literal day-only form when stored as 'YYYY-MM-DD'). Returns an ISO
 * string, or null when the source value is unparseable.
 */
function shiftValue(value: unknown, deltaDays: number): string | null {
  if (typeof value === 'string') {
    const s = value.trim()
    // Day-only storage: shift the calendar day, keep the day-only shape.
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
    if (m) {
      const shifted = addDays(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])), deltaDays)
      const y = shifted.getFullYear()
      const mo = String(shifted.getMonth() + 1).padStart(2, '0')
      const d = String(shifted.getDate()).padStart(2, '0')
      return `${y}-${mo}-${d}`
    }
  }
  // Instant storage: shift by whole days in ms, keeping time-of-day intact.
  const asDate =
    value instanceof Date
      ? value
      : typeof value === 'number' || typeof value === 'string'
        ? new Date(value)
        : null
  if (!asDate || Number.isNaN(asDate.getTime())) return null
  return new Date(asDate.getTime() + deltaDays * 24 * 60 * 60 * 1000).toISOString()
}

export function GanttView({
  startField,
  endField,
  docs,
  useAsTitle,
  onOpen,
  onPeek,
  onDocMenu,
  selectedIds,
  onToggleSelect,
  update,
  cardCols,
}: Props) {
  // Split docs into scheduled (both dates) and unscheduled (missing either).
  const { scheduled, unscheduled } = useMemo(() => {
    const s: Record<string, unknown>[] = []
    const u: Record<string, unknown>[] = []
    for (const doc of docs) {
      const hasStart = valueToDay(doc[startField])
      const hasEnd = valueToDay(doc[endField])
      if (hasStart && hasEnd) s.push(doc)
      else u.push(doc)
    }
    return { scheduled: s, unscheduled: u }
  }, [docs, startField, endField])

  const domain = useMemo(
    () => computeDomain(scheduled, startField, endField),
    [scheduled, startField, endField],
  )
  const weeks = useMemo(() => weekTicks(domain), [domain])
  const months = useMemo(() => monthTicks(domain), [domain])
  const nowX = useMemo(() => todayX(domain), [domain])

  // On open (or when the domain moves), scroll the timeline so today — or the
  // earliest bar when today is outside the domain — sits a quarter in from the
  // left edge instead of landing on the domain's empty leading padding.
  const timelineRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const el = timelineRef.current
    if (!el) return
    let anchorX = nowX
    if (anchorX == null) {
      let min: number | null = null
      for (const doc of scheduled) {
        const day = valueToDay(doc[startField])
        if (day) {
          const x = dayToX(domain, day)
          if (min == null || x < min) min = x
        }
      }
      anchorX = min
    }
    if (anchorX == null) return
    el.scrollLeft = Math.max(0, anchorX - el.clientWidth / 4)
  }, [domain, nowX, scheduled, startField])

  // Live drag delta (whole days) keyed by doc id — applied optimistically to
  // the bar while dragging; committed via `update` on pointerup. `mode` picks
  // what the delta means: 'move' shifts both dates, 'start'/'end' resize one
  // edge (via the hover handles) and never invert the bar (span clamps at 0).
  type DragMode = 'move' | 'start' | 'end'
  // `ids` usually holds one doc — but a 'move' drag that starts on a bar that
  // is part of the current multi-selection carries the WHOLE selection, every
  // carried bar shifting by the same day delta.
  const [dragDelta, setDragDelta] = useState<{ ids: string[]; days: number; mode: DragMode } | null>(
    null,
  )
  // Browsers fire a click after pointerup on the same element, so a completed
  // drag would also toggle selection — swallow the click that follows a drag.
  const suppressClick = useRef(false)

  const startDrag = (doc: Record<string, unknown>, mode: DragMode) => (e: React.PointerEvent) => {
    if (e.button !== 0) return
    // Edge handles sit inside the bar — don't let a resize also start a move.
    e.stopPropagation()
    const id = String(doc.id ?? '')
    // A move-drag on a selected bar carries the whole selection along.
    const ids =
      mode === 'move' && selectedIds?.has(id) && selectedIds.size > 1 ? [...selectedIds] : [id]
    const originX = e.clientX
    const el = e.currentTarget as HTMLElement
    el.setPointerCapture(e.pointerId)

    // Days between the two dates — resize clamps so the span never inverts.
    const span = daysBetween(valueToDay(doc[startField])!, valueToDay(doc[endField])!)
    const clampDays = (days: number): number => {
      if (mode === 'start') return Math.min(days, span) // start can't pass end
      if (mode === 'end') return Math.max(days, -span) // end can't pass start
      return days
    }

    const onMove = (ev: PointerEvent) => {
      const days = clampDays(Math.round((ev.clientX - originX) / DAY_WIDTH))
      setDragDelta((prev) =>
        prev && prev.days === days && prev.mode === mode && prev.ids[0] === ids[0]
          ? prev
          : { ids, days, mode },
      )
    }
    const onUp = (ev: PointerEvent) => {
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
      const rawDays = (ev.clientX - originX) / DAY_WIDTH
      setDragDelta(null)
      // Ignore drags under half a day (lets a plain click fall through).
      if (Math.abs(rawDays) < 0.5) return
      suppressClick.current = true
      const days = clampDays(Math.round(rawDays))
      if (days === 0) return
      for (const carriedId of ids) {
        const carried = docs.find((d) => String(d.id ?? '') === carriedId)
        if (!carried) continue
        const patch: Record<string, unknown> = {}
        if (mode !== 'end') {
          const nextStart = shiftValue(carried[startField], days)
          if (nextStart == null) continue
          patch[startField] = nextStart
        }
        if (mode !== 'start') {
          const nextEnd = shiftValue(carried[endField], days)
          if (nextEnd == null) continue
          patch[endField] = nextEnd
        }
        void update(carriedId, patch).catch((err) => {
          console.error('Failed to reschedule:', err)
        })
      }
    }
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onUp)
  }

  return (
    <div className="gantt">
      <div className="gantt-scroll">
        {/* Left fixed column: doc titles, aligned row-for-row with the timeline. */}
        <div className="gantt-labels" style={{ width: LABEL_W }}>
          <div className="gantt-label-head" style={{ height: ROW_H + 22 }}>
            Task
          </div>
          {scheduled.map((doc) => {
            const id = String(doc.id ?? '')
            return (
              <button
                key={id}
                type="button"
                className={`gantt-label${selectedIds?.has(id) ? ' selected' : ''}`}
                style={{ height: ROW_H }}
                title={docTitle(doc, useAsTitle)}
                {...(onPeek ? longPressHandlers(() => onPeek(id)) : {})}
                onContextMenu={(e) => {
                  if (!onDocMenu) return
                  e.preventDefault()
                  onDocMenu(id, e.clientX, e.clientY)
                }}
                onClick={(e) =>
                  e.metaKey || e.ctrlKey
                    ? onOpen(id)
                    : onToggleSelect
                      ? onToggleSelect(id)
                      : onOpen(id)
                }
                onDoubleClick={() => onOpen(id)}
              >
                {docTitle(doc, useAsTitle)}
              </button>
            )
          })}
        </div>

        {/* Right timeline: month/week header, gridlines, today marker, bars. */}
        <div className="gantt-timeline" ref={timelineRef}>
          <div className="gantt-axis" style={{ width: domain.width, height: ROW_H + 22 }}>
            {months.map((m) => (
              <span key={`m${m.x}`} className="gantt-month" style={{ left: m.x }}>
                {m.label}
              </span>
            ))}
            {weeks.map((w) => (
              <span
                key={`w${w.x}`}
                className="gantt-week-label"
                style={{ left: w.x, top: 22 }}
              >
                {w.date.getDate()}
              </span>
            ))}
          </div>

          <div
            className="gantt-body"
            style={{ width: domain.width, height: scheduled.length * ROW_H }}
          >
            {/* Week gridlines. */}
            {weeks.map((w) => (
              <span key={`g${w.x}`} className="gantt-gridline" style={{ left: w.x }} />
            ))}
            {/* Today marker. */}
            {nowX != null && <span className="gantt-today" style={{ left: nowX }} />}

            {scheduled.map((doc, i) => {
              const id = String(doc.id ?? '')
              const start = valueToDay(doc[startField])!
              const end = valueToDay(doc[endField])!
              // Bars span inclusive of the end day. A live drag applies its
              // delta per mode: 'move' slides the bar, 'start'/'end' pin the
              // opposite edge and grow/shrink the span.
              const drag = dragDelta?.ids.includes(id) ? dragDelta : null
              const startDelta = drag && drag.mode !== 'end' ? drag.days : 0
              const endDelta = drag && drag.mode !== 'start' ? drag.days : 0
              const x = dayToX(domain, start) + startDelta * DAY_WIDTH
              const span = Math.max(0, daysBetween(start, end) - startDelta + endDelta) + 1
              const w = span * DAY_WIDTH
              // Narrow bars can't hold their title — set it beside the bar
              // instead of truncating it to a letter or two inside.
              const labelInside = w >= 80
              const title = docTitle(doc, useAsTitle)
              return (
                <div key={id} style={{ display: 'contents' }}>
                  <div
                    className={`gantt-bar${selectedIds?.has(id) ? ' selected' : ''}${drag && drag.days !== 0 ? ' dragging' : ''}`}
                    style={{ top: i * ROW_H + 4, left: x, width: Math.max(w, 6), height: ROW_H - 8 }}
                    title={title}
                    {...(onPeek ? longPressHandlers(() => onPeek(id)) : {})}
                    onPointerDown={startDrag(doc, 'move')}
                    onContextMenu={(e) => {
                      if (!onDocMenu) return
                      e.preventDefault()
                      onDocMenu(id, e.clientX, e.clientY)
                    }}
                    onClick={(e) => {
                      if (suppressClick.current) {
                        suppressClick.current = false
                        return
                      }
                      // Cmd/Ctrl+click: open in a tab, leave selection alone.
                      if (e.metaKey || e.ctrlKey) return onOpen(id)
                      if (onToggleSelect) onToggleSelect(id)
                      else onOpen(id)
                    }}
                    onDoubleClick={() => onOpen(id)}
                  >
                    {labelInside && (
                      <span className="gantt-bar-label">
                        {title}
                        {cardCols && cardCols.length > 0 && (
                          <CardFields doc={doc} cols={cardCols} inline />
                        )}
                      </span>
                    )}
                    {/* Hover handles: drag an edge to change only that date. */}
                    <span
                      className="gantt-handle left"
                      onPointerDown={startDrag(doc, 'start')}
                      title={`Adjust ${startField}`}
                    />
                    <span
                      className="gantt-handle right"
                      onPointerDown={startDrag(doc, 'end')}
                      title={`Adjust ${endField}`}
                    />
                  </div>
                  {!labelInside && (
                    <span
                      className="gantt-bar-ext-label"
                      style={{ top: i * ROW_H + 4, left: x + Math.max(w, 6) + 6, height: ROW_H - 8 }}
                    >
                      {title}
                      {cardCols && cardCols.length > 0 && (
                        <CardFields doc={doc} cols={cardCols} inline />
                      )}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {unscheduled.length > 0 && (
        <div className="gantt-unscheduled">
          <div className="gantt-unscheduled-head">Unscheduled ({unscheduled.length})</div>
          {unscheduled.map((doc) => {
            const id = String(doc.id ?? '')
            return (
              <button
                key={id}
                type="button"
                className={`gantt-label${selectedIds?.has(id) ? ' selected' : ''}`}
                style={{ height: ROW_H }}
                title={docTitle(doc, useAsTitle)}
                {...(onPeek ? longPressHandlers(() => onPeek(id)) : {})}
                onContextMenu={(e) => {
                  if (!onDocMenu) return
                  e.preventDefault()
                  onDocMenu(id, e.clientX, e.clientY)
                }}
                onClick={(e) =>
                  e.metaKey || e.ctrlKey
                    ? onOpen(id)
                    : onToggleSelect
                      ? onToggleSelect(id)
                      : onOpen(id)
                }
                onDoubleClick={() => onOpen(id)}
              >
                {docTitle(doc, useAsTitle)}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
