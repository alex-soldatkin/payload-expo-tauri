/**
 * InspectorPanel — floating inspector panel that hovers over form content.
 *
 * Extracted from the original DocumentForm.tsx (purely structural; no behavior
 * change).
 *
 * - No backdrop: content behind remains interactive
 * - Draggable: PanResponder lets user reposition horizontally
 * - Swipe right to dismiss
 * - Glass/blur background with rounded corners on all sides
 * - Positioned within the content area (parent View, not full-screen)
 */
import React, { useEffect, useRef } from 'react'
import { Animated, PanResponder, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native'

import type { ClientField } from '../../types'
import { FormSection } from '../../FormSection'
import { useListColors } from '../../hooks/useListColors'
import { BlurView, GlassView, liquidGlassAvailable, useSafeAreaInsets } from '../glass'
import { inspectorStyles } from '../styles'

const INSPECTOR_WIDTH = 320
const INSPECTOR_MARGIN = 12
const DISMISS_THRESHOLD = 100 // px swipe right to dismiss
void INSPECTOR_WIDTH // retained from original (unused module const; preserved verbatim)

export const InspectorPanel: React.FC<{
  visible: boolean
  onClose: () => void
  renderFields: (fields: ClientField[]) => React.ReactNode
  sidebarFields: ClientField[]
}> = ({ visible, onClose, renderFields, sidebarFields }) => {
  const { width: screenWidth } = useWindowDimensions()
  const { dark, colors: pc } = useListColors()
  const insets = useSafeAreaInsets ? useSafeAreaInsets() : { top: 0, bottom: 0 }
  const topInset = Math.max(insets.top + 56, 70)
  const bottomInset = Math.max(insets.bottom + 50, 60)

  // Width adapts to screen: use ~40% of screen width on tablets, max 380px
  // This ensures date pickers, relationship fields etc. aren't cut off.
  const panelWidth = Math.min(Math.max(300, Math.round(screenWidth * 0.4)), 380)

  const panX = useRef(new Animated.Value(screenWidth)).current
  const lastX = useRef(screenWidth)
  // Track if we've ever mounted — once true, stays true to avoid
  // re-rendering the form content below when the panel is dismissed.
  const hasBeenVisible = useRef(false)

  useEffect(() => {
    const target = screenWidth - panelWidth - INSPECTOR_MARGIN
    if (visible) {
      hasBeenVisible.current = true
      lastX.current = target
      Animated.spring(panX, {
        toValue: target,
        useNativeDriver: true,
        damping: 24,
        stiffness: 200,
        mass: 0.8,
      }).start()
    } else {
      lastX.current = screenWidth
      Animated.spring(panX, {
        toValue: screenWidth,
        useNativeDriver: true,
        damping: 24,
        stiffness: 200,
        mass: 0.8,
      }).start()
    }
  }, [visible, screenWidth, panelWidth, panX])

  // PanResponder for drag + swipe-to-dismiss
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > 10 && Math.abs(gs.dx) > Math.abs(gs.dy),
      onPanResponderGrant: () => {
        panX.stopAnimation((val) => { lastX.current = val })
        panX.setOffset(lastX.current)
        panX.setValue(0)
      },
      onPanResponderMove: Animated.event([null, { dx: panX }], { useNativeDriver: false }),
      onPanResponderRelease: (_, gs) => {
        panX.flattenOffset()
        const finalX = lastX.current + gs.dx

        if (gs.dx > DISMISS_THRESHOLD || gs.vx > 0.5) {
          onClose()
          return
        }

        const clamped = Math.max(INSPECTOR_MARGIN, Math.min(finalX, screenWidth - panelWidth - INSPECTOR_MARGIN))
        lastX.current = clamped
        Animated.spring(panX, {
          toValue: clamped,
          useNativeDriver: true,
          damping: 24,
          stiffness: 200,
          mass: 0.8,
        }).start()
      },
    }),
  ).current

  // Don't render until first opened — but once rendered, keep alive
  // (just offscreen) to avoid re-rendering the form below.
  if (!hasBeenVisible.current) return null

  const panelBg = liquidGlassAvailable && GlassView
    ? React.createElement(GlassView as React.ComponentType<any>, {
        style: StyleSheet.absoluteFill,
        glassEffectStyle: 'regular',
      })
    : BlurView
      ? <BlurView style={StyleSheet.absoluteFill} intensity={80} tint="systemThickMaterial" />
      : <View style={[StyleSheet.absoluteFill, { backgroundColor: dark ? 'rgba(30, 30, 30, 0.97)' : 'rgba(255, 255, 255, 0.97)' }]} />

  return (
    <Animated.View
      style={[
        inspectorStyles.panel,
        { borderColor: pc.hairline },
        { width: panelWidth, top: topInset, bottom: bottomInset, transform: [{ translateX: panX }] },
      ]}
      pointerEvents={visible ? 'auto' : 'none'}
      {...panResponder.panHandlers}
    >
      {panelBg}

      {/* Drag handle */}
      <View style={inspectorStyles.dragHandle}>
        <View style={[inspectorStyles.dragPill, { backgroundColor: pc.tertiary }]} />
      </View>

      {/* Header */}
      <View style={inspectorStyles.header}>
        <Text style={[inspectorStyles.headerTitle, { color: pc.text }]}>Details</Text>
        <Pressable onPress={onClose} hitSlop={12}>
          <Text style={[inspectorStyles.closeButton, { color: pc.primary }]}>Done</Text>
        </Pressable>
      </View>

      {/* Scrollable content */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={inspectorStyles.content}
        keyboardShouldPersistTaps="handled"
      >
        <FormSection>
          {renderFields(sidebarFields)}
        </FormSection>
      </ScrollView>
    </Animated.View>
  )
}
