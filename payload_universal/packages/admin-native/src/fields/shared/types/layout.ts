/**
 * Display, layout, and liquid-glass (SwiftUI) component entries of the native
 * registry. iOS-shaped — null on Android (except Divider, which maps to the
 * Android HorizontalDivider).
 *
 * Every entry is nullable: ALWAYS null-check before use.
 */
import type React from 'react'

import type { JCModifier, NativeModifier } from './modifiers'

/** Display / layout / liquid-glass surface of the {@link NativeComponentRegistry}. */
export type NativeComponentRegistryLayout = {
  // ── Display (iOS) ──

  /** SwiftUI Label (title + SF Symbol icon). iOS only. */
  Label: React.ComponentType<{
    title?: string
    systemImage?: string
    icon?: React.ReactNode
    color?: string
    modifiers?: NativeModifier[]
  }> | null

  /** SwiftUI Image (SF Symbols only). iOS only. */
  Image: React.ComponentType<{
    systemName: string
    size?: number
    color?: string
    variableValue?: number
    onPress?: () => void
    modifiers?: NativeModifier[]
  }> | null

  /** SwiftUI ProgressView (spinner when value undefined, bar otherwise). iOS only. */
  ProgressView: React.ComponentType<{
    value?: number | null
    timerInterval?: { lower: Date; upper: Date }
    countsDown?: boolean
    children?: React.ReactNode
    modifiers?: NativeModifier[]
  }> | null

  /** Swift Charts wrapper (line/point/bar/area/pie/rectangle). iOS only. */
  Chart: React.ComponentType<{
    data: Array<{ x: string | number; y: number; color?: string }>
    type?: 'line' | 'point' | 'bar' | 'area' | 'pie' | 'rectangle'
    style?: any
    [key: string]: any
  }> | null

  /** SwiftUI ContentUnavailableView (empty-state placeholder). iOS 17+ only. */
  ContentUnavailableView: React.ComponentType<{
    title?: string
    systemImage?: string
    description?: string
    modifiers?: NativeModifier[]
  }> | null

  /**
   * Native divider/separator hairline. Both platforms.
   * Android: stable removed the single JC `Divider` — this key maps to
   * `HorizontalDivider` (visual parity with canary).
   */
  Divider: React.ComponentType<{
    modifiers?: NativeModifier[] | JCModifier[]
  }> | null

  // ── Layout (iOS) ──

  /** SwiftUI HStack. iOS only. */
  HStack: React.ComponentType<{
    children: React.ReactNode
    spacing?: number
    alignment?: 'top' | 'center' | 'bottom' | 'firstTextBaseline' | 'lastTextBaseline'
    modifiers?: NativeModifier[]
  }> | null

  /** SwiftUI VStack. iOS only. */
  VStack: React.ComponentType<{
    children: React.ReactNode
    spacing?: number
    alignment?: 'leading' | 'center' | 'trailing'
    modifiers?: NativeModifier[]
  }> | null

  /** SwiftUI ZStack. iOS only. */
  ZStack: React.ComponentType<{
    children: React.ReactNode
    alignment?: string
    modifiers?: NativeModifier[]
  }> | null

  /** SwiftUI Spacer. iOS only. */
  Spacer: React.ComponentType<{
    minLength?: number
    modifiers?: NativeModifier[]
  }> | null

  /** SwiftUI Grid. Use GridRow for rows. iOS only. */
  Grid: React.ComponentType<{
    children: React.ReactNode
    alignment?: string
    verticalSpacing?: number
    horizontalSpacing?: number
    modifiers?: NativeModifier[]
  }> | null

  /** SwiftUI Grid.Row. iOS only. */
  GridRow: React.ComponentType<{ children: React.ReactNode }> | null

  // ── Liquid glass (iOS 26+) ──

  /** GlassEffectContainer — groups glassEffect views so they can morph/blend. iOS only. */
  GlassEffectContainer: React.ComponentType<{
    children: React.ReactNode
    spacing?: number
    modifiers?: NativeModifier[]
  }> | null

  /** SwiftUI Namespace provider — needed for glassEffectId/matchedGeometryEffect. iOS only. */
  Namespace: React.ComponentType<{
    id: string
    children: React.ReactNode
  }> | null
}
