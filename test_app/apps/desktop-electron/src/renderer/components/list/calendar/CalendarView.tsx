// Property-driven month calendar (issue #25 slice two). The month is derived
// from the chosen top-level date field: the SAME filtered `docs` array the
// table renders is bucketed by each doc's local day for that field — no
// fetching here. Docs missing the field are simply not placed (a header count
// reports how many are undated). Month navigation is component-only state; the
// chosen field is persisted by the parent (mirrors the board's field picker).
import { useMemo, useState } from 'react'
import { docTitle } from '../../../lib/doc'
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

type Props = {
  fieldName: string
  docs: Record<string, unknown>[]
  useAsTitle?: string
  onOpen: (id: string) => void
}

export function CalendarView({ fieldName, docs, useAsTitle, onOpen }: Props) {
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

      <div className="cal-grid">
        {weekdays.map((w) => (
          <div key={w} className="cal-weekday">
            {w}
          </div>
        ))}
        {cells.map((cell) => {
          const dayDocs = byDay.get(cell.key) ?? []
          const overflow = dayDocs.length - MAX_CELL_CHIPS
          return (
            <div
              key={cell.key}
              className={
                'cal-cell' +
                (cell.inMonth ? '' : ' out') +
                (cell.key === today ? ' today' : '')
              }
            >
              <span className="cal-daynum">{cell.day}</span>
              {dayDocs.slice(0, MAX_CELL_CHIPS).map((doc) => {
                const id = String(doc.id ?? '')
                return (
                  <button
                    key={id}
                    type="button"
                    className="cal-chip"
                    title={docTitle(doc, useAsTitle)}
                    onClick={() => onOpen(id)}
                  >
                    {docTitle(doc, useAsTitle)}
                  </button>
                )
              })}
              {overflow > 0 && <span className="cal-overflow">+{overflow} more</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
