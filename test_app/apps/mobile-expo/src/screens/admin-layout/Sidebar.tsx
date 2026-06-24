/**
 * Persistent tablet sidebar chrome (width, hairline, blur background, safe
 * area). The nav tree itself is the shared SidebarContent — the same
 * component the swipe-in OverlaySidebar panel renders on narrow windows.
 */
import React from 'react'
import { StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useListColors } from '@payload-universal/admin-native'
import { SidebarContent } from '@/src/components/OverlaySidebar'
import { BlurView } from './nativeModules'
import { sidebarStyles } from './styles'

export function Sidebar() {
  const insets = useSafeAreaInsets()
  const { dark, colors: c } = useListColors()

  return (
    <View
      style={[
        sidebarStyles.container,
        { borderRightColor: c.hairline },
        { paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}
    >
      {/* Background – frosted glass or fallback */}
      {BlurView ? (
        <BlurView
          style={StyleSheet.absoluteFill}
          intensity={35}
          tint="systemUltraThinMaterial"
        />
      ) : (
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: dark ? 'rgba(30,30,30,0.88)' : 'rgba(249,249,249,0.85)' },
          ]}
        />
      )}

      <SidebarContent />
    </View>
  )
}
