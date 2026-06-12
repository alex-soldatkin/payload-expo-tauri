import { requireNativeView } from 'expo'
import React from 'react'
import { Dimensions, Platform } from 'react-native'

import type {
  ScrollablePreviewActionProps,
  ScrollablePreviewContentProps,
  ScrollablePreviewTriggerProps,
} from './ScrollablePreview.types'

// Native views — iOS (UIWindow overlay peek) and Android (Dialog peek).
// Other platforms fall back to plain children.
const isNativePlatform = Platform.OS === 'ios' || Platform.OS === 'android'

let NativeTrigger: React.ComponentType<any> | null = null
let NativeContent: React.ComponentType<any> | null = null
let NativeAction: React.ComponentType<any> | null = null

if (isNativePlatform) {
  try {
    NativeTrigger = requireNativeView('ScrollablePreview', 'ScrollablePreviewTriggerView')
    NativeContent = requireNativeView('ScrollablePreview', 'ScrollablePreviewContentView')
    NativeAction = requireNativeView('ScrollablePreview', 'ScrollablePreviewActionView')
  } catch {
    // native module not available (e.g. Expo Go)
  }
}

/**
 * Internal: the preview size resolved by Trigger, consumed by Content.
 *
 * Content sizes its subtree (via absolute positioning) to EXACTLY the size the native
 * overlay will give it. This keeps the Yoga layout in sync with the native frame, so
 * ScrollViews/FlatLists inside the preview have correct content sizes and scroll
 * natively while the peek is open.
 */
const PreviewSizeContext = React.createContext<{ width: number; height: number } | null>(null)

const DEFAULT_WIDTH_FRACTION = 0.92
const DEFAULT_HEIGHT_FRACTION = 0.65

/**
 * Scrollable context preview — Telegram-style long-press peek.
 *
 * - Long press opens the peek: blurred/dimmed backdrop, the Content subtree in a rounded
 *   floating container, and Action rows below it.
 * - Content stays interactive while the peek is open: ScrollViews/FlatLists inside
 *   `ScrollablePreview.Content` scroll natively.
 * - While the long-press finger is still down, sliding it over an action row highlights
 *   it (with haptics); lifting performs the action — like Telegram's context menu.
 * - Dismissal: tap the backdrop, swipe the preview down, or tap the preview itself
 *   (which fires `onPrimaryAction`).
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
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window')
  const heightFraction = props.previewHeightFraction ?? DEFAULT_HEIGHT_FRACTION
  const width = Math.round(props.previewWidth ?? screenWidth * DEFAULT_WIDTH_FRACTION)
  const height = Math.round(props.previewHeight ?? screenHeight * heightFraction)

  const size = React.useMemo(() => ({ width, height }), [width, height])

  if (NativeTrigger) {
    // Pass the resolved size down so native and Yoga agree on the exact preview frame.
    return (
      <PreviewSizeContext.Provider value={size}>
        <NativeTrigger {...props} previewWidth={width} previewHeight={height} />
      </PreviewSizeContext.Provider>
    )
  }
  // Fallback: no preview, just render children
  return <>{props.children}</>
}

/**
 * Content container — its children are shown inside the scrollable peek popup.
 * Hidden until the peek opens. Any ScrollView/FlatList inside scrolls natively
 * while the peek is presented.
 */
export function Content(props: ScrollablePreviewContentProps) {
  const size = React.useContext(PreviewSizeContext)
  if (NativeContent) {
    // Absolute position keeps the (natively hidden) content out of the row layout
    // while sizing the subtree to the exact native preview frame.
    const sizingStyle = size
      ? ({ position: 'absolute', top: 0, left: 0, width: size.width, height: size.height } as const)
      : null
    return <NativeContent {...props} style={[sizingStyle, props.style]} />
  }
  return null // hidden on unsupported platforms
}

/**
 * Action row shown below the preview popup.
 * `icon` is an SF Symbol name (iOS only — ignored on Android).
 */
export function Action(props: ScrollablePreviewActionProps) {
  if (NativeAction) {
    return <NativeAction {...props} />
  }
  return null
}
