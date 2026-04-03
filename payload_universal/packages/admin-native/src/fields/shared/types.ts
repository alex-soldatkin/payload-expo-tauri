/**
 * Type definitions for the native component registry.
 *
 * Extracted into a standalone file (no .ios.ts / .android.ts variants)
 * so Metro platform resolution doesn't cause circular imports.
 */
import type React from 'react'

export type NativeComponentRegistry = {
  /** Whether any native @expo/ui components are available. */
  isAvailable: boolean

  /** Platform-appropriate Host wrapper. */
  Host: React.ComponentType<{
    matchContents?: boolean | { width?: boolean; height?: boolean }
    colorScheme?: 'light' | 'dark'
    ignoreSafeArea?: 'all' | 'keyboard'
    style?: any
    children: React.ReactNode
  }> | null

  /** Native toggle/switch. SwiftUI Toggle (iOS) or JC Switch (Android). */
  Toggle: React.ComponentType<{
    isOn?: boolean
    label?: string
    onIsOnChange?: (isOn: boolean) => void
    children?: React.ReactNode
  }> | null

  /** Native date picker. Available on both platforms. */
  DatePicker: React.ComponentType<{
    title?: string
    selection?: Date
    range?: { start?: Date; end?: Date }
    displayedComponents?: Array<'date' | 'hourAndMinute'>
    onDateChange?: (date: Date) => void
    children?: React.ReactNode
  }> | null

  /** Native picker (single-select). SwiftUI Picker / JC SegmentedButton. */
  Picker: React.ComponentType<{
    selection?: string | number | null
    onSelectionChange?: (selection: string | number | null) => void
    label?: string
    children?: React.ReactNode
    modifiers?: any[]
  }> | null

  /** Native disclosure/accordion. iOS only (SwiftUI DisclosureGroup). */
  DisclosureGroup: React.ComponentType<{
    label: string
    isExpanded?: boolean
    onIsExpandedChange?: (isExpanded: boolean) => void
    children?: React.ReactNode
  }> | null

  /** Native text component for use as Picker option children. */
  Text: React.ComponentType<{
    children?: React.ReactNode
    modifiers?: any[]
  }> | null

  /** Modifier factory: creates a `tag` modifier for Picker options. */
  tag: ((value: string | number) => { $type: string; tag: string | number }) | null

  /** Modifier factory: creates a `pickerStyle` modifier. */
  pickerStyle: ((style: string) => { $type: string; style: string }) | null

  /** Native bottom sheet (SwiftUI .sheet presentation). */
  BottomSheet: React.ComponentType<{
    isPresented: boolean
    onIsPresentedChange: (isPresented: boolean) => void
    fitToContents?: boolean
    children?: React.ReactNode
  }> | null

  /** Group wrapper for applying SwiftUI modifiers to children. */
  Group: React.ComponentType<{
    children?: React.ReactNode
    modifiers?: any[]
  }> | null

  /** Modifier factory: creates presentationDetents modifier. */
  presentationDetents: ((detents: Array<'medium' | 'large' | { fraction: number } | { height: number }>) => any) | null

  /** Modifier factory: creates presentationDragIndicator modifier. */
  presentationDragIndicator: ((visibility: 'automatic' | 'visible' | 'hidden') => any) | null
}

/** Empty registry — all components null, nothing available. */
export const emptyRegistry: NativeComponentRegistry = {
  isAvailable: false,
  Host: null,
  Toggle: null,
  DatePicker: null,
  Picker: null,
  DisclosureGroup: null,
  Text: null,
  tag: null,
  pickerStyle: null,
  BottomSheet: null,
  Group: null,
  presentationDetents: null,
  presentationDragIndicator: null,
}
