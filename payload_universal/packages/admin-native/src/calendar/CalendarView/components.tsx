/**
 * CalendarView — presentational sub-components:
 *  - LegendScroller: horizontal source-legend chips with a right-edge fade hint;
 *  - GlassSection: liquid glass container with a themed bordered fallback;
 *  - AllDayChip: liquid-glass-first all-day event chip (fallback tier);
 *  - EmptyDayState: selected-day empty state (registry ContentUnavailableView
 *    or muted lucide CalendarOff + caption);
 *  - TodayButton: liquid glass / themed bordered "Today" pill.
 */
import React, { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import type { StyleProp, ViewStyle } from 'react-native'

import type { ListColorPalette } from '../../hooks/useListColors'
import { hexToRgba } from '../../kanban/types'
import { NativeHost } from '../../fields/NativeHost'
import { nativeComponents } from '../../fields/shared'
import type { CalendarEvent } from '../../scheduling'
import type { CalendarStyles } from './styles'

// Optional: GlassView for the liquid glass surfaces on iOS 26+
let GlassView: React.ComponentType<any> | null = null
let liquidGlassAvailable = false
try {
  const glassModule = require('expo-glass-effect')
  GlassView = glassModule.GlassView
  liquidGlassAvailable = glassModule.isLiquidGlassAvailable?.() ?? false
} catch {
  /* expo-glass-effect not installed */
}

// Optional: LinearGradient for the legend scroller's right-edge fade hint
// (signals more chips scroll off-screen). Falls back to a flat fade View when
// expo-linear-gradient isn't installed — the chips never clip either way.
let LinearGradient: React.ComponentType<any> | null = null
try {
  LinearGradient = require('expo-linear-gradient').LinearGradient ?? null
} catch {
  /* expo-linear-gradient not installed — flat fade fallback */
}

// Optional: lucide legend empty-state icon (pure RN SVG) with a text fallback
let CalendarOffIcon: React.ComponentType<{ size: number; color: string }> | null = null
try {
  const lucide = require('lucide-react-native')
  CalendarOffIcon = lucide.CalendarOff ?? lucide.CalendarX2 ?? lucide.CalendarDays ?? null
} catch {
  /* lucide-react-native not available */
}

// ---------------------------------------------------------------------------
// LegendScroller — horizontal source-legend chips with a right-edge fade hint.
//
// The chips already live in a horizontal ScrollView; the fade is the missing
// affordance — with 3+ sources the row scrolls but the last chip looked
// clipped at the screen edge ("Schedu…"). A right-edge gradient (or a flat
// fade fallback) signals "more →" and is shown ONLY while content overflows
// AND hasn't been scrolled to the end. Measurement only — no gesture beyond
// the ScrollView itself. The fade colour matches the surface beneath so it
// reads as the chips dissolving, not a stripe.
// ---------------------------------------------------------------------------

export function LegendScroller({
  chips,
  fadeColor,
  style,
  contentContainerStyle,
}: {
  chips: React.ReactNode
  /** Solid surface colour beneath the chips (header card / screen bg). */
  fadeColor: string
  style: StyleProp<ViewStyle>
  contentContainerStyle: StyleProp<ViewStyle>
}) {
  const [viewportW, setViewportW] = useState(0)
  const [contentW, setContentW] = useState(0)
  const [offsetX, setOffsetX] = useState(0)
  // Overflow + not yet scrolled to the very end ⇒ more chips hide right.
  const atEnd = offsetX + viewportW >= contentW - 1
  const showFade = contentW > viewportW + 1 && !atEnd

  return (
    // position:relative wrapper so the fade can pin to the scroller's right
    // edge regardless of how far the content has scrolled.
    <View style={[styles_legendFade.wrap, style]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={contentContainerStyle}
        scrollEventThrottle={16}
        onLayout={(e) => setViewportW(e.nativeEvent.layout.width)}
        onContentSizeChange={(w) => setContentW(w)}
        onScroll={(e) => setOffsetX(e.nativeEvent.contentOffset.x)}
      >
        {chips}
      </ScrollView>
      {showFade ? (
        LinearGradient ? (
          <LinearGradient
            pointerEvents="none"
            colors={[hexToRgba(fadeColor, 0), fadeColor]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles_legendFade.fade}
          />
        ) : (
          // Flat fade fallback — a soft right-edge wash when no gradient lib.
          <View
            pointerEvents="none"
            style={[styles_legendFade.fade, { backgroundColor: hexToRgba(fadeColor, 0.7) }]}
          />
        )
      ) : null}
    </View>
  )
}

const styles_legendFade = StyleSheet.create({
  wrap: { position: 'relative' },
  fade: { position: 'absolute', top: 0, bottom: 0, right: 0, width: 28 },
})

// ---------------------------------------------------------------------------
// GlassSection — liquid glass container with a themed bordered fallback
// (regular-width header row + month-mode side panel)
// ---------------------------------------------------------------------------

export function GlassSection({
  style,
  fallbackStyle,
  children,
}: {
  style: StyleProp<ViewStyle>
  fallbackStyle: StyleProp<ViewStyle>
  children: React.ReactNode
}) {
  if (liquidGlassAvailable && GlassView) {
    return (
      <GlassView style={style} glassEffectStyle="regular">
        {children}
      </GlassView>
    )
  }
  return <View style={[style, fallbackStyle]}>{children}</View>
}

// ---------------------------------------------------------------------------
// All-day chip — liquid glass first, source-tinted bordered fallback
// ---------------------------------------------------------------------------

export function AllDayChip({
  event,
  dark,
  fallbackColor,
  styles,
  onPress,
}: {
  event: CalendarEvent
  dark: boolean
  fallbackColor: string
  styles: CalendarStyles
  onPress: () => void
}) {
  const color = event.color ?? fallbackColor
  const inner = (
    <View style={styles.allDayChipInner}>
      <View style={[styles.allDayChipDot, { backgroundColor: color }]} />
      <Text style={styles.allDayChipLabel} numberOfLines={1}>
        {event.title}
      </Text>
    </View>
  )
  const body =
    liquidGlassAvailable && GlassView ? (
      <GlassView style={styles.allDayChip} isInteractive glassEffectStyle="regular">
        {inner}
      </GlassView>
    ) : (
      <View
        style={[
          styles.allDayChip,
          {
            backgroundColor: hexToRgba(color, dark ? 0.2 : 0.1),
            borderWidth: 1,
            borderColor: hexToRgba(color, 0.45),
          },
        ]}
      >
        {inner}
      </View>
    )
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={event.title}
      style={({ pressed }) => [pressed && styles.chipPressed]}
    >
      {body}
    </Pressable>
  )
}

// ---------------------------------------------------------------------------
// EmptyDayState — selected-day panel/list empty state (month mode). Registry
// ContentUnavailableView (SwiftUI, iOS 17+) when available, else a muted
// lucide CalendarOff + caption. Renders inside the day panel's glass card /
// list so it inherits the surface — no chrome of its own beyond spacing.
// ---------------------------------------------------------------------------

const ContentUnavailable = nativeComponents.ContentUnavailableView

export function EmptyDayState({
  styles,
  colors,
}: {
  styles: CalendarStyles
  colors: ListColorPalette
}) {
  if (ContentUnavailable) {
    return (
      // Fixed-height box so the stretched Host has an explicit frame
      // (mirrors DocumentList's EmptyState sizing pattern).
      <View style={styles.emptyDayNativeBox}>
        <NativeHost matchContents={false} style={styles.flexFill}>
          <ContentUnavailable
            title="No Events"
            systemImage="calendar.badge.minus"
            description="No events on this day"
          />
        </NativeHost>
      </View>
    )
  }
  return (
    <View style={styles.emptyDay}>
      {CalendarOffIcon ? <CalendarOffIcon size={28} color={colors.textMuted} /> : null}
      <Text style={styles.emptyDayText}>No events on this day</Text>
    </View>
  )
}

// ---------------------------------------------------------------------------
// Today button — liquid glass first, themed bordered fallback. `embedded`
// (inside the regular-width glass header) skips the nested glass and renders
// a hairline-bordered pill instead (glass-in-glass renders poorly).
// ---------------------------------------------------------------------------

export function TodayButton({
  onPress,
  styles,
  embedded = false,
}: {
  onPress: () => void
  styles: CalendarStyles
  embedded?: boolean
}) {
  const inner = <Text style={styles.todayLabel}>Today</Text>
  const body = embedded ? (
    <View style={[styles.todayBtn, styles.todayBtnEmbedded]}>{inner}</View>
  ) : liquidGlassAvailable && GlassView ? (
    <GlassView style={styles.todayBtn} isInteractive glassEffectStyle="regular">
      {inner}
    </GlassView>
  ) : (
    <View style={[styles.todayBtn, styles.todayBtnFallback]}>{inner}</View>
  )
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Go to today"
      style={({ pressed }) => [pressed && styles.todayPressed]}
    >
      {body}
    </Pressable>
  )
}
