import { requireNativeView } from 'expo'
import React from 'react'
import { Platform } from 'react-native'

import type {
  ScrollablePreviewActionProps,
  ScrollablePreviewContentProps,
  ScrollablePreviewTriggerProps,
} from './ScrollablePreview.types'

// Native views — iOS only (Android falls back to plain views)
const isIOS = Platform.OS === 'ios'

let NativeTrigger: React.ComponentType<any> | null = null
let NativeContent: React.ComponentType<any> | null = null
let NativeAction: React.ComponentType<any> | null = null

if (isIOS) {
  try {
    NativeTrigger = requireNativeView('ScrollablePreview', 'ScrollablePreviewTriggerView')
    NativeContent = requireNativeView('ScrollablePreview', 'ScrollablePreviewContentView')
    NativeAction = requireNativeView('ScrollablePreview', 'ScrollablePreviewActionView')
  } catch {
    // native module not available (e.g. Expo Go)
  }
}

/**
 * Scrollable context preview — Telegram-style long-press popup.
 *
 * Usage:
 * ```tsx
 * <ScrollablePreview.Trigger onPrimaryAction={navigate}>
 *   <RowContent />
 *   <ScrollablePreview.Content>
 *     <ScrollView>...</ScrollView>
 *   </ScrollablePreview.Content>
 *   <ScrollablePreview.Action title="Open" icon="doc.text" onActionPress={open} />
 *   <ScrollablePreview.Action title="Delete" icon="trash" destructive onActionPress={del} />
 * </ScrollablePreview.Trigger>
 * ```
 */
export function Trigger(props: ScrollablePreviewTriggerProps) {
  if (NativeTrigger) {
    return <NativeTrigger {...props} />
  }
  // Fallback: no preview, just render children
  return <>{props.children}</>
}

export function Content(props: ScrollablePreviewContentProps) {
  if (NativeContent) {
    return <NativeContent {...props} />
  }
  return null // hidden on non-iOS
}

export function Action(props: ScrollablePreviewActionProps) {
  if (NativeAction) {
    return <NativeAction {...props} />
  }
  return null
}
