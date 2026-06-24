/**
 * SidebarEdgeTab — Apple Notes/Freeform-style affordance on the content's
 * right edge that opens the Details (sidebar fields) sheet. Rendered only on
 * wide layouts (>= EDGE_TAB_MIN_WIDTH); phones keep the header toolbar
 * button, where a persistent edge tab would crowd the content.
 *
 * Extracted from the original DocumentForm.tsx (purely structural; no behavior
 * change).
 */
import React from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { PanelRight } from 'lucide-react-native'

import { GlassView, liquidGlassAvailable } from '../glass'
import { edgeTabStyles } from '../styles'

export const SidebarEdgeTab: React.FC<{ onPress: () => void; colors: Record<string, string> }> = ({ onPress, colors }) => {
  const inner = (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel="Open details"
      style={edgeTabStyles.press}
    >
      <PanelRight size={18} color={colors.primary} />
    </Pressable>
  )
  if (liquidGlassAvailable && GlassView) {
    return (
      <View style={edgeTabStyles.container} pointerEvents="box-none">
        <GlassView style={edgeTabStyles.glass} isInteractive glassEffectStyle="regular">
          {inner}
        </GlassView>
      </View>
    )
  }
  return (
    <View style={edgeTabStyles.container} pointerEvents="box-none">
      <View style={[edgeTabStyles.glass, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth }]}>
        {inner}
      </View>
    </View>
  )
}
