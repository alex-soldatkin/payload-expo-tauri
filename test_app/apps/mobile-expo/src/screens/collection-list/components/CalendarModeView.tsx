/**
 * Calendar mode renderer — same local-first docs through the same screen-hosted
 * filter pipeline; sources from useCalendarConfig (defaults via
 * pickDefaultSources); native month/day views injected from the app's
 * calendar-view module with JS fallbacks inside CalendarView.
 */
import React from 'react'
import { View } from 'react-native'
import {
  CalendarView,
  type CalendarMode,
  type CalendarSource,
} from '@payload-universal/admin-native'
import { BoardFilterChips, type BoardFilterChipsProps } from './BoardFilterChips'
// Direct module import is correct here (screens own native-module injection;
// admin-native receives it via CalendarView's nativeModule prop)
import * as calendarNativeModule from '@/modules/calendar-view'

export type CalendarModeViewProps = {
  headerHeight: number
  filterChips: BoardFilterChipsProps
  docs: Record<string, unknown>[]
  sources: CalendarSource[]
  useAsTitle?: string
  mode: CalendarMode
  onChangeMode: (mode: CalendarMode) => void
  selectedDate: string
  onChangeSelectedDate: (date: string) => void
  onPressDoc: (doc: Record<string, unknown>) => void
  renderDocRow: (doc: Record<string, unknown>, defaultCard: React.ReactElement) => React.ReactElement
}

export function CalendarModeView({
  headerHeight,
  filterChips,
  docs,
  sources,
  useAsTitle,
  mode,
  onChangeMode,
  selectedDate,
  onChangeSelectedDate,
  onPressDoc,
  renderDocRow,
}: CalendarModeViewProps) {
  return (
    <View style={{ flex: 1, paddingTop: headerHeight }}>
      <BoardFilterChips {...filterChips} />
      <CalendarView
        docs={docs}
        sources={sources}
        useAsTitle={useAsTitle}
        mode={mode}
        onChangeMode={onChangeMode}
        selectedDate={selectedDate}
        onChangeSelectedDate={onChangeSelectedDate}
        onPressDoc={onPressDoc}
        // Day-list rows get the same long-press peek as list rows/cards
        renderDocRow={renderDocRow}
        nativeModule={calendarNativeModule}
      />
    </View>
  )
}
