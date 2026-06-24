/**
 * VisibilitySection — SEPARATE non-drag section (see GanttCustomizeSheet
 * docblock): native SwiftUI Toggle switches are safe here, OUTSIDE the
 * Sortable tree. ON = source visible on the gantt (sets `hidden` in the
 * draft; buildGanttRows skips hidden sources after save). lucide Eye/EyeOff
 * Pressable fallback when the registry Toggle is null.
 */
import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { Eye, EyeOff } from 'lucide-react-native'
import { type CalendarSource, type ListColorPalette } from '@payload-universal/admin-native'
import { nativeComponents, NativeHost } from '@payload-universal/admin-native/fields'

import { type SheetStyles } from '../styles'

// Visibility switches (list view) — registry SwiftUI Toggle with the DEFAULT
// toggleStyle (a switch), exactly like the checkbox field. Rendered ONLY in
// this non-drag section (never inside Sortable trees).
const NativeToggle = nativeComponents.Toggle

export type VisibilitySectionProps = {
  sources: CalendarSource[]
  styles: SheetStyles
  colors: ListColorPalette
  setSourceVisible: (id: string, visible: boolean) => void
}

export function VisibilitySection({
  sources,
  styles,
  colors,
  setSourceVisible,
}: VisibilitySectionProps) {
  if (sources.length === 0) return null
  return (
    <>
      <Text style={styles.sectionLabel}>VISIBILITY</Text>
      {sources.map((source) => {
        const sourceVisible = source.hidden !== true
        return (
          <View key={source.id} style={styles.row}>
            <View style={styles.rowInner}>
              <View style={[styles.swatch, { backgroundColor: source.color }]} />
              <View style={styles.fieldInfo}>
                <Text
                  style={[styles.rowLabel, !sourceVisible && styles.rowLabelHidden]}
                  numberOfLines={1}
                >
                  {source.label}
                </Text>
              </View>
            </View>
            {NativeToggle ? (
              <NativeHost matchContents>
                <NativeToggle
                  isOn={sourceVisible}
                  onIsOnChange={(isOn: boolean) => setSourceVisible(source.id, isOn)}
                />
              </NativeHost>
            ) : (
              <Pressable
                hitSlop={8}
                style={styles.rowAction}
                onPress={() => setSourceVisible(source.id, !sourceVisible)}
                accessibilityRole="switch"
                accessibilityState={{ checked: sourceVisible }}
                accessibilityLabel={`${sourceVisible ? 'Hide' : 'Show'} ${source.label}`}
              >
                {sourceVisible ? (
                  <Eye size={20} color={colors.primary} />
                ) : (
                  <EyeOff size={20} color={colors.textPlaceholder} />
                )}
              </Pressable>
            )}
          </View>
        )
      })}
    </>
  )
}
