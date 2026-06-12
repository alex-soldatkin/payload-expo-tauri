/**
 * TimeAxis — the gantt's sticky header band: a month band over per-day
 * ticks, with weekend shading and a primary-tint today bubble.
 *
 * Rendered to the FULL timeline width inside the horizontal ScrollView (so
 * it scrolls horizontally with the grid) but OUTSIDE the rows FlatList (so
 * it stays vertically pinned). Its own background is transparent — the
 * chart paints a viewport-fixed liquid-glass band behind it (glass must not
 * scroll with the content, and one viewport-wide GlassView is far cheaper
 * than a timeline-wide one).
 *
 * Day ticks render one View per window day; the window is edge-extended in
 * 60-day steps, so the cell count grows with deep scrolling — React.memo
 * keeps re-renders to actual window/density changes (the chart's per-frame
 * scroll work never touches axis props).
 */
import React, { useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { useListColors } from '../hooks/useListColors'
import type { ListColorPalette } from '../hooks/useListColors'
import { dateKeyFromDayIndex, getFirstDayOfWeek, parseDateKey } from '../scheduling'
import { GANTT_AXIS_HEIGHT } from './types'

export type TimeAxisProps = {
  /** Date key at x = 0 (the window's first day — the GanttScale epoch). */
  windowStartKey: string
  /** Days in the window (axis width = totalDays * pxPerDay). */
  totalDays: number
  pxPerDay: number
  /** Today's local date key — rendered as a primary-tint bubble. */
  todayKey: string
}

/** Month band height; day ticks take the rest of GANTT_AXIS_HEIGHT. */
const MONTH_BAND_HEIGHT = 20
const DAY_ROW_HEIGHT = GANTT_AXIS_HEIGHT - MONTH_BAND_HEIGHT

/** Below this density day numbers only render on the locale's week start. */
const ALL_DAY_LABELS_MIN_PX = 16
/** Month labels hide on segments narrower than this. */
const MONTH_LABEL_MIN_WIDTH = 44

type AxisDay = {
  key: string
  label: number
  weekend: boolean
  isToday: boolean
  showLabel: boolean
}
type AxisMonth = { key: string; label: string; startIndex: number; days: number }

const monthLabel = (d: Date, fallback: string): string => {
  try {
    return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
  } catch {
    return fallback
  }
}

const TimeAxisInner: React.FC<TimeAxisProps> = ({
  windowStartKey,
  totalDays,
  pxPerDay,
  todayKey,
}) => {
  const { colors } = useListColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  const firstDayOfWeek = useMemo(getFirstDayOfWeek, [])

  const { days, months } = useMemo(() => {
    const dayList: AxisDay[] = []
    const monthList: AxisMonth[] = []
    const showAll = pxPerDay >= ALL_DAY_LABELS_MIN_PX
    for (let i = 0; i < totalDays; i += 1) {
      const key = dateKeyFromDayIndex(i, windowStartKey)
      const d = parseDateKey(key)
      if (!d) continue // unreachable for valid windows — keys are derived
      const jsDay = d.getDay()
      dayList.push({
        key,
        label: d.getDate(),
        weekend: jsDay === 0 || jsDay === 6,
        isToday: key === todayKey,
        showLabel: showAll || jsDay === firstDayOfWeek,
      })
      const mKey = key.slice(0, 7)
      const last = monthList[monthList.length - 1]
      if (!last || last.key !== mKey) {
        monthList.push({ key: mKey, label: monthLabel(d, mKey), startIndex: i, days: 1 })
      } else {
        last.days += 1
      }
    }
    return { days: dayList, months: monthList }
  }, [windowStartKey, totalDays, pxPerDay, todayKey, firstDayOfWeek])

  return (
    <View style={[styles.axis, { width: totalDays * pxPerDay }]} pointerEvents="none">
      <View style={styles.monthBand}>
        {months.map((m) => (
          <View
            key={m.key}
            style={[
              styles.monthSeg,
              { left: m.startIndex * pxPerDay, width: m.days * pxPerDay },
            ]}
          >
            {m.days * pxPerDay >= MONTH_LABEL_MIN_WIDTH ? (
              <Text style={styles.monthLabel} numberOfLines={1}>
                {m.label}
              </Text>
            ) : null}
          </View>
        ))}
      </View>
      <View style={styles.dayRow}>
        {days.map((day) => (
          <View
            key={day.key}
            style={[
              styles.dayCell,
              { width: pxPerDay },
              day.weekend && styles.dayCellWeekend,
            ]}
          >
            {day.isToday ? (
              <View style={styles.todayBubble}>
                <Text style={styles.todayText}>{day.label}</Text>
              </View>
            ) : day.showLabel ? (
              <Text style={[styles.dayText, day.weekend && styles.dayTextWeekend]}>
                {day.label}
              </Text>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  )
}

export const TimeAxis = React.memo(TimeAxisInner)
TimeAxis.displayName = 'TimeAxis'

// ---------------------------------------------------------------------------
// Styles — dark-mode aware palette only (zero hardcoded light colours)
// ---------------------------------------------------------------------------

const createStyles = (c: ListColorPalette) =>
  StyleSheet.create({
    axis: {
      height: GANTT_AXIS_HEIGHT,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.hairline,
    },

    monthBand: { height: MONTH_BAND_HEIGHT, overflow: 'hidden' },
    monthSeg: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      justifyContent: 'center',
      paddingLeft: 6,
      borderLeftWidth: StyleSheet.hairlineWidth,
      borderLeftColor: c.hairline,
    },
    monthLabel: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      color: c.textMuted,
    },

    dayRow: { flexDirection: 'row', height: DAY_ROW_HEIGHT },
    dayCell: { alignItems: 'center', justifyContent: 'center' },
    dayCellWeekend: { backgroundColor: c.pressed },
    dayText: { fontSize: 10, fontWeight: '500', color: c.textMuted },
    dayTextWeekend: { color: c.textPlaceholder },
    todayBubble: {
      width: 20,
      height: 20,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.primary,
    },
    todayText: { fontSize: 10, fontWeight: '700', color: c.primaryText },
  })
