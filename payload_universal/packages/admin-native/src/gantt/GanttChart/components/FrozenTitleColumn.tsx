// ---------------------------------------------------------------------------
// Frozen title column (absolute overlay, translateY-synced)
// ---------------------------------------------------------------------------
//
// GLASS IS BACKGROUND-ONLY (the DocumentListTable rule): the title column
// renders a GlassView as an absolute-fill layer with the text/Pressable
// content as plain RN SIBLINGS above it — NEVER as GlassView children (the
// G1 invisible-titles bug). The overlay's rows translate with the FlatList
// scroll via the Animated value handed in from the chart.
import React from 'react'
import { Animated, Pressable, Text, View } from 'react-native'

import type { ListColorPalette } from '../../../hooks/useListColors'
import type { ScheduleDoc } from '../../../scheduling'
import type { GanttRowModel } from '../../types'
import { ChevronRightIcon, GlassView, liquidGlassAvailable } from '../optionalDeps'
import type { createStyles } from '../styles'

export type FrozenTitleColumnProps = {
  rows: GanttRowModel[]
  styles: ReturnType<typeof createStyles>
  colors: ListColorPalette
  dragLock: boolean
  titleTranslateY: Animated.AnimatedMultiplication<number>
  onPressDoc: (doc: ScheduleDoc) => void
}

export const FrozenTitleColumn: React.FC<FrozenTitleColumnProps> = ({
  rows,
  styles,
  colors,
  dragLock,
  titleTranslateY,
  onPressDoc,
}) => {
  const titleInner = (
    <>
      <View style={styles.titleCorner}>
        <Text style={styles.titleCornerText} numberOfLines={1}>
          {`${rows.length} ${rows.length === 1 ? 'doc' : 'docs'}`}
        </Text>
      </View>
      <View style={styles.titleRowsClip}>
        <Animated.View style={{ transform: [{ translateY: titleTranslateY }] }}>
          {rows.map((row) => (
            <Pressable
              key={row.docId}
              style={({ pressed }) => [
                styles.titleRow,
                { height: row.height },
                pressed && styles.titleRowPressed,
              ]}
              onPress={dragLock ? undefined : () => onPressDoc(row.doc)}
              accessibilityRole="button"
              accessibilityLabel={row.title}
            >
              <Text style={styles.titleText} numberOfLines={2}>
                {row.title}
              </Text>
              {ChevronRightIcon ? (
                <ChevronRightIcon size={14} color={colors.tertiary} />
              ) : (
                <Text style={styles.titleChevron}>{'›'}</Text>
              )}
            </Pressable>
          ))}
        </Animated.View>
      </View>
    </>
  )

  // Frozen title column — absolute glass overlay; its rows translate with the
  // FlatList scroll (Animated.event in the chart).
  return liquidGlassAvailable && GlassView ? (
    <GlassView style={styles.titleOverlay} glassEffectStyle="regular">
      {titleInner}
    </GlassView>
  ) : (
    <View style={[styles.titleOverlay, styles.titleOverlayFallback]}>
      {titleInner}
    </View>
  )
}
