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
 * MONTH LABELS are sticky-segment (the iOS section-header pattern, on the
 * horizontal axis): every month segment renders its label, and the label of
 * the month currently under the viewport's LEFT EDGE pins just right of the
 * frozen title column while its segment is in view. The pinning is a pure
 * native-driver transform — each label's translateX interpolates the
 * chart's Animated scrollX over [segmentStart − stickyOffset, … + travel]
 * (clamped), so scrolling never re-renders the axis. Alignment audit: month
 * segments sit at startIndex*pxPerDay and day ticks are a flex row of
 * pxPerDay-wide cells from the same window start — both derive every x from
 * the identical (dayIndex × pxPerDay) basis, so band and ticks can never
 * drift apart.
 *
 * Day ticks render one View per window day; the window is edge-extended in
 * 60-day steps, so the cell count grows with deep scrolling — React.memo
 * keeps re-renders to actual window/density changes (the chart's per-frame
 * scroll work never touches axis props; scrollX is a stable Animated ref).
 */
import React, { useMemo } from 'react'
import { Animated, StyleSheet, Text, View } from 'react-native'

import { useListColors } from '../hooks/useListColors'
import type { ListColorPalette } from '../hooks/useListColors'
import { dateKeyFromDayIndex, getFirstDayOfWeek, parseDateKey } from '../scheduling'
import { GANTT_AXIS_HEIGHT, GANTT_AXIS_TOP_PAD, GANTT_TITLE_COLUMN_WIDTH } from './types'

export type TimeAxisProps = {
  /** Date key at x = 0 (the window's first day — the GanttScale epoch). */
  windowStartKey: string
  /** Days in the window (axis width = totalDays * pxPerDay). */
  totalDays: number
  pxPerDay: number
  /** Today's local date key — rendered as a primary-tint bubble. */
  todayKey: string
  /**
   * The horizontal scroll offset as a (native-driver) Animated value.
   * Powers the sticky month labels; omit and labels stay at their month
   * starts (static fallback).
   */
  scrollX?: Animated.Value
}

/** Month band height; day ticks take the rest of GANTT_AXIS_HEIGHT. */
const MONTH_BAND_HEIGHT = 20
const DAY_ROW_HEIGHT = GANTT_AXIS_HEIGHT - MONTH_BAND_HEIGHT

/** Below this density day numbers only render on the locale's week start. */
const ALL_DAY_LABELS_MIN_PX = 16
/** Month labels hide on segments narrower than this. */
const MONTH_LABEL_MIN_WIDTH = 44
/** Fixed sticky-label box ('SEP 2026' at 10pt caps fits comfortably). */
const MONTH_LABEL_WIDTH = 96
/**
 * Where a pinned label rests: just right of the frozen title column (the
 * column overlays the viewport's left 150pt, axis band included — pinning
 * at the raw left edge would hide the label underneath it).
 */
const MONTH_LABEL_STICKY_OFFSET = GANTT_TITLE_COLUMN_WIDTH

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
  scrollX,
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
        {months.map((m) => {
          const segLeft = m.startIndex * pxPerDay
          const segWidth = m.days * pxPerDay
          if (segWidth < MONTH_LABEL_MIN_WIDTH) {
            return (
              <View key={m.key} style={[styles.monthSeg, { left: segLeft, width: segWidth }]} />
            )
          }
          // Sticky travel: how far the label can slide within its segment
          // before it must yield to the next month's label.
          const travel = Math.max(segWidth - MONTH_LABEL_WIDTH, 0)
          const labelText = (
            <Text style={styles.monthLabel} numberOfLines={1}>
              {m.label}
            </Text>
          )
          return (
            <View key={m.key} style={[styles.monthSeg, { left: segLeft, width: segWidth }]}>
              {scrollX && travel > 0 ? (
                <Animated.View
                  style={{
                    width: MONTH_LABEL_WIDTH,
                    transform: [
                      {
                        translateX: scrollX.interpolate({
                          inputRange: [
                            segLeft - MONTH_LABEL_STICKY_OFFSET,
                            segLeft - MONTH_LABEL_STICKY_OFFSET + travel,
                          ],
                          outputRange: [0, travel],
                          extrapolate: 'clamp',
                        }),
                      },
                    ],
                  }}
                >
                  {labelText}
                </Animated.View>
              ) : (
                labelText
              )}
            </View>
          )
        })}
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
      height: GANTT_AXIS_TOP_PAD + GANTT_AXIS_HEIGHT,
      paddingTop: GANTT_AXIS_TOP_PAD,
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
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.primary,
    },
    todayText: { fontSize: 10, fontWeight: '700', color: c.primaryText },
  })
